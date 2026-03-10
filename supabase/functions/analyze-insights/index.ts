import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface FormResponse {
  answers: Record<string, any>;
  customerName?: string;
  additionalFeedback?: string;
}

interface FormData {
  name: string;
  questions: Array<{ id: string; text: string; type: string }>;
  responses: FormResponse[];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { forms } = await req.json() as { forms: FormData[] };
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Build a summary of all survey data for the AI
    const surveyDataSummary = forms.map(form => {
      const responsesSummary = form.responses.map((r, idx) => {
        const answerText = Object.entries(r.answers || {})
          .map(([questionId, answer]) => {
            const question = form.questions.find(q => q.id === questionId);
            return `Q: ${question?.text || questionId} - A: ${JSON.stringify(answer)}`;
          })
          .join('\n');
        
        return `Response ${idx + 1}:\n${answerText}${r.additionalFeedback ? `\nFeedback: ${r.additionalFeedback}` : ''}`;
      }).join('\n\n');

      return `Form: "${form.name}"\nQuestions: ${form.questions.map(q => q.text).join(', ')}\n\nResponses (${form.responses.length} total):\n${responsesSummary}`;
    }).join('\n\n---\n\n');

    console.log("Analyzing survey data for insights...");
    console.log("Survey data summary length:", surveyDataSummary.length);

    const totalResponses = forms.reduce((sum, f) => sum + f.responses.length, 0);
    
    // If not enough data, return default insights
    if (totalResponses < 1) {
      return new Response(JSON.stringify({
        insights: [{
          priority: "medium",
          category: "Getting Started",
          message: "Start collecting customer feedback to unlock AI-powered insights.",
          suggestedActions: ["Share your form QR code", "Promote your feedback form", "Offer an incentive for responses"]
        }]
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { 
            role: "system", 
            content: `You are an expert retail analytics consultant analyzing customer survey feedback. Identify actionable insights from the data provided. Focus on patterns, customer satisfaction, and business improvements.`
          },
          { 
            role: "user", 
            content: `Analyze this customer survey data and provide key insights:\n\n${surveyDataSummary}` 
          }
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "provide_insights",
              description: "Provide structured insights from customer survey analysis",
              parameters: {
                type: "object",
                properties: {
                  insights: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        priority: { type: "string", enum: ["high", "medium", "low"] },
                        category: { type: "string", description: "Short category name (2-3 words)" },
                        message: { type: "string", description: "A clear, specific insight based on the data (1-2 sentences)" },
                        suggestedActions: { 
                          type: "array", 
                          items: { type: "string" },
                          description: "3 specific actionable suggestions"
                        }
                      },
                      required: ["priority", "category", "message", "suggestedActions"],
                      additionalProperties: false
                    },
                    minItems: 1,
                    maxItems: 3
                  }
                },
                required: ["insights"],
                additionalProperties: false
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "provide_insights" } }
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limits exceeded, please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required, please add funds to your workspace." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    console.log("AI response:", JSON.stringify(data, null, 2));
    
    // Extract tool call response
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall || toolCall.function.name !== "provide_insights") {
      console.error("No valid tool call in response");
      throw new Error("Failed to get structured insights from AI");
    }

    let insights;
    try {
      insights = JSON.parse(toolCall.function.arguments);
    } catch (parseError) {
      console.error("Failed to parse tool call arguments:", parseError);
      console.error("Raw arguments:", toolCall.function.arguments);
      throw new Error("Failed to parse AI insights");
    }

    return new Response(JSON.stringify(insights), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in analyze-insights function:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
