export interface Client {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  type: 'Homeowner' | 'Developer';
  jobDescription: string;
  estimate: number;
  actualBudget: number;
  createdAt: string;
}

export interface Estimate {
  contractorId: string;
  contractorName: string;
  amount: number;
  submittedAt: string;
  type: 'rough' | 'final';
}

export interface Project {
  id: string;
  uid: string;
  title: string;
  description?: string;
  clientId?: string;
  status: 'New Open Project' | 'Rough Estimates' | 'Final Estimates' | 'On Hold' | 'In Contract' | 'In Progress' | 'Completed' | 'Abandoned';
  budget: number;
  startDate: string;
  endDate?: string;
  category: string;
  imageUrl?: string;
  photos?: string[];
  location?: {
    street: string;
    town: string;
    zip: string;
  };
  phone?: string;
  services?: string[];
  photoCount?: number;
  roughEstimates?: Estimate[];
  finalEstimates?: Estimate[];
  selectedContractorId?: string;
  expirationDate?: string;
  inspectionDate?: string;
  createdAt: string;
}

export interface Task {
  id: string;
  projectId: string;
  title: string;
  description: string;
  status: 'Todo' | 'In Progress' | 'Done';
  dueDate: string;
  assignedTo: string;
}

export interface Invoice {
  id: string;
  projectId: string;
  amount: number;
  status: 'Paid' | 'Pending' | 'Overdue';
  date: string;
}

export interface DOBPermit {
  id: string;
  borough: string;
  house_number: string;
  street_name: string;
  address?: string;
  zip_code?: string;
  latitude?: number | null;
  longitude?: number | null;
  job_type: string;
  permit_status: string;
  filing_date: string;
  issuance_date: string;
  job_description: string;
  owner_name: string;
  owner_business_name: string;
  applicant_license?: string;
  contact_name?: string;
  phone?: string;
}

export interface Lead {
  id: string;
  name: string;
  email: string;
  phone: string;
  category: string;
  description: string;
  startDate?: string;
  status: 'New Lead' | 'Contacted' | 'Converted' | 'Closed';
  location?: {
    street?: string;
    town?: string;
    zip?: string;
  };
  photoCount?: number;
  photos?: string[];
  createdAt: string;
  updatedAt?: string;
}

export interface LeadMarketplaceItem {
  id: string;
  leadId: string;
  category: string;
  description: string;
  status: 'Open' | 'Requested' | 'Assigned' | 'Closed';
  location?: {
    town?: string;
    zip?: string;
  };
  photoCount?: number;
  photos?: string[];
  createdAt: string;
  updatedAt?: string;
}

export interface LeadInquiry {
  id: string;
  leadId: string;
  contractorId: string;
  contractorName: string;
  contractorEmail: string;
  message: string;
  status: 'Requested' | 'Reviewed' | 'Matched' | 'Closed';
  createdAt: string;
  updatedAt?: string;
}

export interface LeadActivity {
  id: string;
  leadId: string;
  inquiryId?: string;
  eventType: 'status_changed' | 'admin_message_sent';
  recipientType?: 'homeowner' | 'home-pro';
  message: string;
  actorId?: string;
  actorName?: string;
  createdAt: string;
}

export type UserRole = 'Homeowner' | 'Contractor' | 'admin';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  phone?: string;
  street?: string;
  town?: string;
  zip?: string;
  avatar?: string;
  rating?: number;
  isVerified?: boolean;
  governmentIdNumber?: string;
  licenseNumber?: string;
  licenseStatus?: 'Active' | 'Pending' | 'Expired' | 'Invalid';
  isTradesman?: boolean;
  trade?: string;
  accountPlan?: 'trial' | 'standard';
  trialStartedAt?: string;
  trialEndsAt?: string;
  subscriptionLevel?: 'none' | 'trial' | 'beginner' | 'junior' | 'pro';
}
