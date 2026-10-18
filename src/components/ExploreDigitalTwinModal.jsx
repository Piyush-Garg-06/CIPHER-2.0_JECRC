import React from 'react';
import CardiovascularReportModal from './CardiovascularReportModal';

export default function ExploreDigitalTwinModal({ isOpen, onClose, patient, onOpenCardioReport }) {
  if (!isOpen || !patient) return null;

  return (
    <CardiovascularReportModal
      patient={patient}
      onClose={onClose}
      onOpenCareAction={onOpenCardioReport}
    />
  );
}
