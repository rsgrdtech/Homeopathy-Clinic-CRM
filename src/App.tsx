import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Search, 
  UserPlus, 
  History, 
  ClipboardList, 
  Pill, 
  ExternalLink, 
  CheckCircle2, 
  XCircle, 
  Database, 
  Plus,
  ArrowRight,
  RotateCcw,
  Phone
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Papa from 'papaparse';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Patient, Visit, Remedy } from './types';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const DEFAULT_SHEET_URL = "https://docs.google.com/spreadsheets/d/11aZgt8hafBHfu0ZHeuyQH_MS09791YHXy_r-7LWc8KM/edit?gid=369787331#gid=369787331";
const BASE_MATERIA_URL = "https://www.materiamedica.info/en/materia-medica/john-henry-clarke/";

// This URL will be provided by the user after setting up Google Apps Script
const APPS_SCRIPT_URL = (import.meta as any).env.VITE_APPS_SCRIPT_URL || "";

export default function App() {
  const [activeTab, setActiveTab] = useState<'patient' | 'history' | 'visit'>('patient');
  const [searchPhone, setSearchPhone] = useState('');
  const [currentPatient, setCurrentPatient] = useState<Patient | null>(null);
  const [visitHistory, setVisitHistory] = useState<Visit[]>([]);
  const [sheetUrl, setSheetUrl] = useState(localStorage.getItem('remedy_sheet_url') || DEFAULT_SHEET_URL);
  const [remedies, setRemedies] = useState<Remedy[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isSavingVisit, setIsSavingVisit] = useState(false);
  const [searchResults, setSearchResults] = useState<Remedy[]>([]);
  const [selectedRemedyUrl, setSelectedRemedyUrl] = useState<string | null>(null);

  // Form States
  const [patientForm, setPatientForm] = useState<Partial<Patient>>({ state: 'CA' });
  const [visitForm, setVisitForm] = useState<Partial<Visit>>({
    date: new Date().toISOString().split('T')[0],
    symptoms: `${new Date().toISOString().split('T')[0]}; `,
    diagnosis: '',
    prescription: ''
  });

  // Update symptoms date when visit date changes
  useEffect(() => {
    if (visitForm.date && (!visitForm.symptoms || visitForm.symptoms.includes('; '))) {
      const parts = (visitForm.symptoms || '').split('; ');
      if (parts.length <= 2) {
        setVisitForm(prev => ({ ...prev, symptoms: `${visitForm.date}; ${parts[1] || ''}` }));
      }
    }
  }, [visitForm.date]);

  // Fetch remedies from sheet
  const loadLocalRemedies = useCallback(async () => {
    const savedRemedies = localStorage.getItem('local_remedies_cache');
    if (savedRemedies) {
      try {
        const data = JSON.parse(savedRemedies);
        setRemedies(data);
        setIsConnected(true);
      } catch (e) {
        console.error("Cache parse error", e);
      }
    }
  }, []);

  // Sync remedies from sheet
  const syncRemedies = useCallback(async (url: string) => {
    if (!url) return;
    setIsSyncing(true);
    try {
      // Convert standard Google Sheet URL to CSV export URL
      let exportUrl = url;
      if (url.includes("docs.google.com/spreadsheets/d/")) {
        const match = url.match(/\/d\/([^\/]+)/);
        if (match) {
          const docId = match[1];
          const gidMatch = url.match(/[#&?]gid=([0-9]+)/);
          const gid = gidMatch ? gidMatch[1] : '0';
          exportUrl = `https://docs.google.com/spreadsheets/d/${docId}/export?format=csv&gid=${gid}`;
        }
      }

      const response = await fetch(exportUrl);
      const csvData = await response.text();
      Papa.parse(csvData, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          setRemedies(results.data as Remedy[]);
          localStorage.setItem('local_remedies_cache', JSON.stringify(results.data));
          setIsConnected(true);
          setIsSyncing(false);
          alert(`Synced ${results.data.length} remedies successfully.`);
        }
      });
    } catch (error) {
      console.error("Failed to sync remedies:", error);
      setIsSyncing(false);
      alert("Failed to sync remedies. Ensure the sheet is 'Published to the Web' as a CSV.");
    }
  }, []);

  useEffect(() => {
    loadLocalRemedies();
  }, [loadLocalRemedies]);

  // Search Patient
  const handleSearchPatient = async () => {
    if (!searchPhone) return;
    if (!APPS_SCRIPT_URL) {
      alert("Google Apps Script URL not configured. Please set VITE_APPS_SCRIPT_URL.");
      return;
    }

    try {
      const response = await fetch(`${APPS_SCRIPT_URL}?action=getPatient&phone=${searchPhone}`);
      const data = await response.json();
      
      if (data.status === 'success' && data.patient) {
        setCurrentPatient(data.patient);
        setVisitHistory(data.history || []);
        setPatientForm(data.patient);
        setActiveTab('history');
      } else {
        alert("Patient not found. Please register.");
        setPatientForm({ phone: searchPhone, state: 'CA' });
        setCurrentPatient(null);
        setVisitHistory([]);
        setActiveTab('patient');
      }
    } catch (error) {
      console.error("Search error:", error);
      alert("Error connecting to Google Sheets. Check your Apps Script URL.");
    }
  };

  // Save Patient
  const handleSavePatient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!patientForm.phone || !patientForm.firstName || !patientForm.sex || !patientForm.city) {
      alert("Please fill all mandatory fields.");
      return;
    }

    if (!APPS_SCRIPT_URL) {
      alert("Google Apps Script URL not configured.");
      return;
    }

    try {
      const response = await fetch(APPS_SCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors', // Apps Script requires no-cors for simple POST
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'savePatient',
          data: patientForm
        })
      });
      
      // With no-cors, we can't check response.ok, but we assume success if no error thrown
      setCurrentPatient(patientForm as Patient);
      alert("Patient record sent to Google Sheets.");
      setActiveTab('visit');
    } catch (error) {
      console.error("Save patient error:", error);
      alert("Failed to save patient.");
    }
  };

  // Save Visit
  const handleSaveVisit = async () => {
    if (!currentPatient) return;
    if (!APPS_SCRIPT_URL) {
      alert("Google Apps Script URL not configured.");
      return;
    }

    setIsSavingVisit(true);
    try {
      await fetch(APPS_SCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'saveVisit',
          data: {
            ...visitForm,
            patientPhone: currentPatient.phone
          }
        })
      });

      alert("Prescription history updated in Google Sheets.");
      // Reset app to blank state for next patient
      setCurrentPatient(null);
      setVisitHistory([]);
      setSearchPhone('');
      setPatientForm({ state: 'CA' });
      setVisitForm({
        date: new Date().toISOString().split('T')[0],
        symptoms: `${new Date().toISOString().split('T')[0]}; `,
        diagnosis: '',
        prescription: ''
      });
      setSearchResults([]);
      setActiveTab('patient');
    } catch (error) {
      console.error("Save visit error:", error);
      alert("Failed to save consultation.");
    } finally {
      setIsSavingVisit(false);
    }
  };

  const handleHardRefresh = () => {
    // Hard refresh simulation: clear cache and reload
    localStorage.removeItem('local_remedies_cache');
    window.location.reload();
  };

  // Remedy Search Logic
  useEffect(() => {
    if (!visitForm.prescription) {
      setSearchResults([]);
      return;
    }

    // Get the last typed part of the prescription
    const parts = visitForm.prescription.split(',').map(p => p.trim());
    const lastPart = parts[parts.length - 1];
    
    if (!lastPart) {
      setSearchResults([]);
      return;
    }

    // Search logic: name + potency or just name
    const filtered = remedies.filter(r => {
      const name = r['Remedy Name']?.toLowerCase() || '';
      const potency = r['Potency']?.toLowerCase() || '';
      const query = lastPart.toLowerCase();
      
      // Prefix match for name or name + potency
      return name.includes(query) || `${name} ${potency}`.includes(query);
    });

    setSearchResults(filtered);
  }, [visitForm.prescription, remedies]);

  const addRemedyToPrescription = (remedy: Remedy) => {
    const getAvailable = (r: any) => {
      const val = String(r['Available y/n'] || r['available'] || '').toLowerCase().trim();
      return val === 'y' || val === 'yes' || val === '1' || val === 'available' || val === 'true';
    };

    if (!getAvailable(remedy)) return;

    const currentPrescription = visitForm.prescription || '';
    const parts = currentPrescription.split(',').map(p => p.trim());
    
    const remedyName = remedy['Remedy Name'] || remedy['name'] || '';
    const potency = remedy['Potency'] || remedy['potency'] || '';
    const remedyString = `${remedyName} ${potency}`.trim();

    if (parts.length > 0 && parts[parts.length - 1] !== '') {
      parts[parts.length - 1] = remedyString;
    } else {
      if (parts.length > 0 && parts[parts.length - 1] === '') {
        parts[parts.length - 1] = remedyString;
      } else {
        parts.push(remedyString);
      }
    }
    
    const newPrescription = parts.filter(p => p !== '').join(', ') + ', ';
    setVisitForm(prev => ({ ...prev, prescription: newPrescription }));
  };

  const repeatRemedies = (oldPrescription: string) => {
    setVisitForm(prev => ({ ...prev, prescription: oldPrescription }));
    setActiveTab('visit');
  };

  return (
    <div className="min-h-screen bg-[#F5F2ED] text-[#1A1A1A] font-sans selection:bg-emerald-100">
      {/* Header */}
      <header className="bg-white border-b border-black/5 px-6 py-4 sticky top-0 z-50 backdrop-blur-md bg-white/80">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-emerald-200">
              <ClipboardList size={24} />
            </div>
            <div>
              <h1 className="text-xl font-semibold tracking-tight">Patient CRM</h1>
              <p className="text-xs text-black/40 font-medium uppercase tracking-wider">Standalone Web App</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Connection Status Button - Hard Refresh */}
            <button
              onClick={handleHardRefresh}
              className={cn(
                "px-6 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2 border-2",
                isConnected 
                  ? "bg-emerald-500 text-white border-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.3)]" 
                  : "bg-white text-black/40 border-black/10 hover:bg-black/5"
              )}
            >
              <Database size={16} className={isConnected ? "animate-pulse" : ""} />
              {isConnected ? "CONNECTED" : "CONNECT"}
            </button>

            <div className="flex items-center gap-2 bg-[#F5F2ED] p-1 rounded-xl border border-black/5">
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-black/30" size={16} />
                <input 
                  type="text" 
                  placeholder="Search Phone #" 
                  className="pl-9 pr-4 py-2 bg-transparent border-none focus:ring-0 text-sm w-48"
                  value={searchPhone}
                  onChange={(e) => setSearchPhone(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearchPatient()}
                />
              </div>
              <button 
                onClick={handleSearchPatient}
                className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors flex items-center gap-2"
              >
                <Search size={16} />
                Search
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Navigation & Remedy Source (Narrow) */}
        <div className="lg:col-span-2 space-y-6">
          <nav className="flex flex-col gap-2">
            {[
              { id: 'patient', label: 'Patients', icon: UserPlus },
              { id: 'history', label: 'Prescription History', icon: History },
              { id: 'visit', label: 'Consultation', icon: Pill },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200",
                  activeTab === tab.id 
                    ? "bg-white text-emerald-700 shadow-sm border border-black/5" 
                    : "text-black/50 hover:bg-black/5"
                )}
              >
                <tab.icon size={18} />
                <span className="hidden xl:inline">{tab.label}</span>
                <span className="xl:hidden">{tab.label.split(' ')[0]}</span>
              </button>
            ))}
          </nav>

          <div className="bg-emerald-900 text-white rounded-2xl p-4 shadow-xl">
            <div className="flex items-center gap-2 mb-3">
              <Database size={16} className="text-emerald-400" />
              <h3 className="font-semibold text-[10px] uppercase tracking-wider">Remedies Sheet</h3>
            </div>
            <div className="space-y-2">
              <input 
                type="text"
                placeholder="Sheet URL"
                className="w-full bg-white/10 border-none rounded-lg px-2 py-1.5 text-[10px] text-white placeholder:text-white/30 focus:ring-1 ring-emerald-400/50"
                value={sheetUrl}
                onChange={e => setSheetUrl(e.target.value)}
              />
              <button 
                onClick={() => {
                  localStorage.setItem('remedy_sheet_url', sheetUrl);
                  syncRemedies(sheetUrl);
                }}
                disabled={isSyncing}
                className="w-full bg-emerald-500 text-white py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-wider hover:bg-emerald-400 transition-colors"
              >
                {isSyncing ? "Syncing..." : "Sync Remedies"}
              </button>
            </div>
          </div>
        </div>

        {/* Middle Column: Main Workspace (Wide) */}
        <div className="lg:col-span-7 space-y-6">
          <AnimatePresence mode="wait">
            {activeTab === 'patient' && (
              <motion.div 
                key="patient-tab"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                className="bg-white rounded-2xl border border-black/5 p-6 shadow-sm"
              >
                <form className="space-y-4" onSubmit={handleSavePatient}>
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold text-emerald-800">Patient Registration</h2>
                    {currentPatient && (
                      <span className="text-[10px] font-bold bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full uppercase">
                        Editing: {currentPatient.firstName}
                      </span>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase text-black/40">First Name *</label>
                      <input 
                        required
                        className="w-full bg-[#F5F2ED] border-none rounded-lg px-3 py-2 text-sm focus:ring-2 ring-emerald-500/20"
                        value={patientForm.firstName || ''}
                        onChange={e => setPatientForm({...patientForm, firstName: e.target.value})}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase text-black/40">Last Name</label>
                      <input 
                        className="w-full bg-[#F5F2ED] border-none rounded-lg px-3 py-2 text-sm focus:ring-2 ring-emerald-500/20"
                        value={patientForm.lastName || ''}
                        onChange={e => setPatientForm({...patientForm, lastName: e.target.value})}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase text-black/40">Sex *</label>
                      <select 
                        required
                        className="w-full bg-[#F5F2ED] border-none rounded-lg px-3 py-2 text-sm focus:ring-2 ring-emerald-500/20"
                        value={patientForm.sex || ''}
                        onChange={e => setPatientForm({...patientForm, sex: e.target.value as any})}
                      >
                        <option value="">Select...</option>
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase text-black/40">City *</label>
                      <input 
                        required
                        className="w-full bg-[#F5F2ED] border-none rounded-lg px-3 py-2 text-sm focus:ring-2 ring-emerald-500/20"
                        value={patientForm.city || ''}
                        onChange={e => setPatientForm({...patientForm, city: e.target.value})}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase text-black/40">CellPhone # *</label>
                      <input 
                        required
                        className="w-full bg-[#F5F2ED] border-none rounded-lg px-3 py-2 text-sm focus:ring-2 ring-emerald-500/20"
                        value={patientForm.phone || ''}
                        onChange={e => setPatientForm({...patientForm, phone: e.target.value})}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase text-black/40">Date of Birth</label>
                      <input 
                        type="date"
                        className="w-full bg-[#F5F2ED] border-none rounded-lg px-3 py-2 text-sm focus:ring-2 ring-emerald-500/20"
                        value={patientForm.dob || ''}
                        onChange={e => setPatientForm({...patientForm, dob: e.target.value})}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase text-black/40">Age (if DOB unknown)</label>
                      <input 
                        type="number"
                        className="w-full bg-[#F5F2ED] border-none rounded-lg px-3 py-2 text-sm focus:ring-2 ring-emerald-500/20"
                        value={patientForm.age || ''}
                        onChange={e => setPatientForm({...patientForm, age: parseInt(e.target.value) || 0})}
                      />
                    </div>
                  </div>

                  <button 
                    type="submit"
                    className="w-full bg-emerald-600 text-white py-3 rounded-xl font-semibold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100 flex items-center justify-center gap-2 mt-4"
                  >
                    Save Patient Record
                    <ArrowRight size={18} />
                  </button>
                </form>
              </motion.div>
            )}

            {activeTab === 'visit' && (
              <motion.div 
                key="visit-tab"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                className="bg-white rounded-2xl border border-black/5 p-6 shadow-sm space-y-4"
              >
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-lg font-semibold text-emerald-800">Consultation</h2>
                  <span className="text-[10px] font-bold bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full uppercase">
                    {currentPatient?.firstName} {currentPatient?.lastName}
                  </span>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-black/40">Date</label>
                  <input 
                    type="date"
                    className="w-full bg-[#F5F2ED] border-none rounded-lg px-3 py-2 text-sm"
                    value={visitForm.date}
                    onChange={e => setVisitForm({...visitForm, date: e.target.value})}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-black/40">Symptoms (DATE; Symptoms)</label>
                  <textarea 
                    rows={4}
                    className="w-full bg-[#F5F2ED] border-none rounded-lg px-3 py-2 text-sm resize-none focus:ring-2 ring-emerald-500/20"
                    value={visitForm.symptoms}
                    onChange={e => setVisitForm({...visitForm, symptoms: e.target.value})}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-black/40">Diagnosis</label>
                  <textarea 
                    rows={2}
                    className="w-full bg-[#F5F2ED] border-none rounded-lg px-3 py-2 text-sm resize-none focus:ring-2 ring-emerald-500/20"
                    value={visitForm.diagnosis}
                    onChange={e => setVisitForm({...visitForm, diagnosis: e.target.value})}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-black/40">Prescription</label>
                  <textarea 
                    rows={4}
                    placeholder="Search remedies on the right..."
                    className="w-full bg-[#F5F2ED] border-none rounded-lg px-3 py-2 text-sm resize-none font-mono ring-2 ring-emerald-500/10 focus:ring-emerald-500/30"
                    value={visitForm.prescription}
                    onChange={e => setVisitForm({...visitForm, prescription: e.target.value})}
                  />
                </div>

                <button 
                  onClick={handleSaveVisit}
                  disabled={isSavingVisit || !currentPatient}
                  className="w-full bg-emerald-600 text-white py-3 rounded-xl font-semibold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSavingVisit ? "Saving..." : "Complete Consultation"}
                  <CheckCircle2 size={18} />
                </button>
              </motion.div>
            )}

            {activeTab === 'history' && (
              <motion.div 
                key="history-tab"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                className="bg-white rounded-2xl border border-black/5 p-6 shadow-sm space-y-4"
              >
                <h2 className="text-lg font-semibold mb-4 text-emerald-800">Visit History</h2>
                {visitHistory.length === 0 ? (
                  <div className="text-center py-12 text-black/20">
                    <History size={48} className="mx-auto mb-2 opacity-10" />
                    <p>No history found.</p>
                  </div>
                ) : (
                  <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
                    {visitHistory.map((visit, idx) => (
                      <div key={idx} className="p-4 bg-[#F5F2ED] rounded-xl border border-black/5 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-emerald-700">{visit.date}</span>
                          <button 
                            onClick={() => repeatRemedies(visit.prescription)}
                            className="text-[10px] font-bold uppercase text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
                          >
                            <RotateCcw size={12} />
                            Repeat
                          </button>
                        </div>
                        <div className="grid grid-cols-1 gap-2">
                          <div>
                            <p className="text-[9px] font-bold text-black/30 uppercase">Symptoms</p>
                            <p className="text-xs text-black/70">{visit.symptoms}</p>
                          </div>
                          <div>
                            <p className="text-[9px] font-bold text-black/30 uppercase">Prescription</p>
                            <p className="text-xs font-mono text-emerald-800">{visit.prescription}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Right Column: Remedy Finder & Materia Medica (Tools) */}
        <div className="lg:col-span-3 space-y-6">
          <div className="bg-white rounded-2xl border border-black/5 overflow-hidden shadow-sm flex flex-col h-[400px]">
            <div className="bg-black/5 px-4 py-3 border-b border-black/5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Search size={14} className="text-black/40" />
                <h3 className="text-[10px] font-bold uppercase tracking-wider text-black/60">Remedy Finder</h3>
              </div>
              <span className="text-[10px] font-bold text-black/30">{searchResults.length}</span>
            </div>
            
            <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
              {searchResults.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-black/20 p-4 text-center">
                  <Pill size={24} className="mb-2 opacity-10" />
                  <p className="text-[10px]">Type in prescription to search...</p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {searchResults.map((remedy, idx) => {
                    const getAvailable = (r: any) => {
                      const val = String(r['Available y/n'] || r['available'] || '').toLowerCase().trim();
                      return val === 'y' || val === 'yes' || val === '1' || val === 'available' || val === 'true';
                    };
                    const isAvailable = getAvailable(remedy);
                    const remedyName = remedy['Remedy Name'] || remedy['name'] || '';
                    const potency = remedy['Potency'] || remedy['potency'] || '';
                    const boxNum = remedy['BOX Number'] || remedy['boxNumber'] || '';
                    
                    return (
                      <motion.div 
                        key={idx}
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        onClick={() => {
                          if (isAvailable) addRemedyToPrescription(remedy);
                          const slug = remedyName.toLowerCase().replace(/\s+/g, '-');
                          setSelectedRemedyUrl(`${BASE_MATERIA_URL}${slug}`);
                        }}
                        className={cn(
                          "p-2 rounded-lg border transition-all cursor-pointer group flex items-center justify-between",
                          isAvailable 
                            ? "bg-emerald-50 border-emerald-200 hover:bg-emerald-100" 
                            : "bg-red-50 border-red-100 opacity-50 grayscale"
                        )}
                      >
                        <div className="flex-1 min-w-0">
                          <h4 className="font-bold text-[11px] text-black/80 truncate leading-tight">{remedyName}</h4>
                          <div className="flex items-center gap-1.5 text-[8px] text-black/40 font-mono">
                            <span className="text-emerald-700 font-bold">{potency}</span>
                            <span>•</span>
                            <span>BOX {boxNum}</span>
                          </div>
                        </div>
                        {isAvailable ? (
                          <div className="w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center text-white shrink-0">
                            <Plus size={12} />
                          </div>
                        ) : (
                          <XCircle size={12} className="text-red-400 shrink-0" />
                        )}
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-black/5 overflow-hidden shadow-sm flex flex-col h-[350px]">
            <div className="bg-black/5 px-4 py-2 border-b border-black/5 flex items-center justify-between">
              <h3 className="text-[10px] font-bold uppercase tracking-wider text-black/60">Materia Medica</h3>
              {selectedRemedyUrl && (
                <a href={selectedRemedyUrl} target="_blank" rel="noreferrer" className="text-[9px] text-emerald-600 hover:underline">
                  Open Full
                </a>
              )}
            </div>
            <div className="flex-1 bg-[#F5F2ED]">
              {selectedRemedyUrl ? (
                <iframe src={selectedRemedyUrl} className="w-full h-full border-none opacity-90" title="Materia Medica" />
              ) : (
                <div className="h-full flex items-center justify-center text-black/10 text-[9px] uppercase font-bold text-center p-4">
                  Select a remedy to view details
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="max-w-7xl mx-auto p-6 text-center">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-black/20">
          Professional Medical CRM &copy; 2024
        </p>
      </footer>
    </div>
  );
}
