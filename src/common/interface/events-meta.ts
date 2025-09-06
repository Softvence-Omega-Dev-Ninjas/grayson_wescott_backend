export interface AnnouncementMeta {
  announcementId: string;
  performedBy: string;
  publishedAt: Date;
}

export interface RecognitionMeta {
  recognitionId: string;
  performedBy: string;
  createdAt: Date;
}

export interface ShiftMeta {
  shiftId: string;
  userId: string;
  performedBy: string;
  status:
    | 'APPROVED'
    | 'REJECTED'
    | 'PENDING'
    | 'ASSIGNED'
    | 'URGENT_SHIFT_CHANGED';
  date: string; // ISO string
}

export interface TimeOffMeta {
  requestId: string;
  userId: string;
  performedBy: string;
  status: 'APPROVED' | 'REJECTED' | 'PENDING';
  startDate: string;
  endDate: string;
}
