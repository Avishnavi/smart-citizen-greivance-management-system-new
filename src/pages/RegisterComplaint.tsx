import React, { useState } from 'react';
import { useComplaints } from '../context/ComplaintContext';
import { MultiStepProgressBar } from '../components/complaint/MultiStepProgressBar';
import { Step1InputMethod } from '../components/complaint/Step1InputMethod';
import { Step2LocationPicker } from '../components/complaint/Step2LocationPicker';
import { Step3AIAnalysis } from '../components/complaint/Step3AIAnalysis';
import { Step4ReviewConfirm } from '../components/complaint/Step4ReviewConfirm';
import { Step5Success } from '../components/complaint/Step5Success';
import type { Complaint } from '../types';

export const RegisterComplaint: React.FC = () => {
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [submittedComplaint, setSubmittedComplaint] = useState<Complaint | null>(null);

  const { submitDraftComplaint, resetDraft } = useComplaints();

  const handleStep1Next = () => setCurrentStep(2);
  const handleStep2Next = () => setCurrentStep(3);
  const handleStep2Back = () => setCurrentStep(1);
  const handleStep3Next = () => setCurrentStep(4);
  const handleStep3Back = () => setCurrentStep(2);

  const handleStep4Edit = (targetStep: number) => {
    setCurrentStep(targetStep);
  };

  const handleStep4Submit = async () => {
    try {
      const created = await submitDraftComplaint();
      setSubmittedComplaint(created);
      setCurrentStep(5);
    } catch (e) {
      console.error('Submission failed:', e);
    }
  };

  const handleResetWizard = () => {
    resetDraft();
    setSubmittedComplaint(null);
    setCurrentStep(1);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-200">
      {/* Wizard Step Progress Bar */}
      <MultiStepProgressBar
        currentStep={currentStep}
        onStepClick={(step) => setCurrentStep(step)}
      />

      {/* Step Renderers */}
      {currentStep === 1 && <Step1InputMethod onNext={handleStep1Next} />}

      {currentStep === 2 && (
        <Step2LocationPicker onNext={handleStep2Next} onBack={handleStep2Back} />
      )}

      {currentStep === 3 && (
        <Step3AIAnalysis onNext={handleStep3Next} onBack={handleStep3Back} />
      )}

      {currentStep === 4 && (
        <Step4ReviewConfirm
          onEdit={handleStep4Edit}
          onSubmit={handleStep4Submit}
        />
      )}

      {currentStep === 5 && submittedComplaint && (
        <Step5Success
          complaint={submittedComplaint}
          onReset={handleResetWizard}
        />
      )}
    </div>
  );
};
