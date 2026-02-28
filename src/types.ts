export interface Patient {
  phone: string;
  firstName: string;
  lastName: string;
  sex: 'Male' | 'Female' | 'Other';
  city: string;
  state: string;
  dob?: string;
  age?: number;
}

export interface Visit {
  id?: number;
  patientPhone: string;
  date: string;
  symptoms: string;
  diagnosis: string;
  prescription: string;
}

export interface Remedy {
  'Remedy Name': string;
  'Potency': string;
  'BOX Number': string;
  'Section': string;
  'Type': string;
  'Bottle Size': string;
  'BottleCapColor': string;
  'Manufacturer Brand': string;
  'Available y/n': string;
  'Reorder Y/N': string;
  'Reorder Date': string;
}
