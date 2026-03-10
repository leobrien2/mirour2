"use client";

import { Switch } from '@/components/ui/switch';

type FormSettingsProps = {
  formName: string;
  internalGoal: string;
  perk: string;
  hasPerk: boolean;
  captureName: boolean;
  captureEmail: boolean;
  capturePhone: boolean;
  onFormNameChange: (value: string) => void;
  onInternalGoalChange: (value: string) => void;
  onPerkChange: (value: string) => void;
  onHasPerkChange: (value: boolean) => void;
  onCaptureNameChange: (value: boolean) => void;
  onCaptureEmailChange: (value: boolean) => void;
  onCapturePhoneChange: (value: boolean) => void;
};

export function FormSettings({
  formName,
  internalGoal,
  perk,
  hasPerk,
  captureName,
  captureEmail,
  capturePhone,
  onFormNameChange,
  onInternalGoalChange,
  onPerkChange,
  onHasPerkChange,
  onCaptureNameChange,
  onCaptureEmailChange,
  onCapturePhoneChange,
}: FormSettingsProps) {
  return (
    <div className="space-y-6">
      <div>
        <label className="block text-foreground mb-2">Flow Name *</label>
        <input
          type="text"
          value={formName}
          onChange={(e) => onFormNameChange(e.target.value)}
          className="w-full px-4 py-3 rounded-2xl border-2 border-primary/20 focus:outline-none focus:border-primary bg-card"
          placeholder="e.g., Customer Feedback Survey"
        />
      </div>

      <div className="bg-secondary rounded-2xl p-4 border-2 border-primary/20">
        <div className="flex items-center justify-between mb-3">
          <label className="text-foreground">Offer a perk for completion</label>
          <Switch checked={hasPerk} onCheckedChange={onHasPerkChange} />
        </div>
        {hasPerk && (
          <input
            type="text"
            value={perk}
            onChange={(e) => onPerkChange(e.target.value)}
            className="w-full px-4 py-3 rounded-2xl border-2 border-primary/20 focus:outline-none focus:border-primary bg-card"
            placeholder="e.g., Free Coffee, 10% Off"
          />
        )}
      </div>

      {/* Internal Goal - hidden for now
      <div className="bg-secondary rounded-2xl p-4 border-2 border-primary/20">
        <label className="block text-foreground mb-2">Internal Goal</label>
        <input
          type="text"
          value={internalGoal}
          onChange={(e) => onInternalGoalChange(e.target.value)}
          className="w-full px-4 py-3 rounded-2xl border-2 border-primary/20 focus:outline-none focus:border-primary bg-card"
          placeholder="e.g., Understand customer preferences"
        />
        <p className="text-sm text-muted-foreground mt-2">Not shown to customers</p>
      </div>
      */}

      <div className="bg-card rounded-2xl p-4 border-2 border-primary/20">
        <label className="block text-foreground mb-3">Customer Information</label>
        <div className="space-y-2">
          <label className="flex items-center gap-3 text-foreground cursor-pointer">
            <input
              type="checkbox"
              checked={captureName}
              onChange={(e) => onCaptureNameChange(e.target.checked)}
              className="w-5 h-5 rounded border-primary text-primary focus:ring-primary"
            />
            Name
          </label>
          <label className="flex items-center gap-3 text-foreground cursor-pointer">
            <input
              type="checkbox"
              checked={captureEmail}
              onChange={(e) => onCaptureEmailChange(e.target.checked)}
              className="w-5 h-5 rounded border-primary text-primary focus:ring-primary"
            />
            Email
          </label>
          <label className="flex items-center gap-3 text-foreground cursor-pointer">
            <input
              type="checkbox"
              checked={capturePhone}
              onChange={(e) => onCapturePhoneChange(e.target.checked)}
              className="w-5 h-5 rounded border-primary text-primary focus:ring-primary"
            />
            Phone
          </label>
        </div>
      </div>
    </div>
  );
}
