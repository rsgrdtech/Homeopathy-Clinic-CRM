import streamlit as st
import pandas as pd
import requests
import datetime
import re

# --- CONFIGURATION ---
# Replace with your actual Google Apps Script URL from the previous step
APPS_SCRIPT_URL = st.sidebar.text_input("Apps Script URL", type="password")
REMEDY_SHEET_URL = "https://docs.google.com/spreadsheets/d/11aZgt8hafBHfu0ZHeuyQH_MS09791YHXy_r-7LWc8KM/export?format=csv&gid=369787331"
MATERIA_MEDICA_BASE = "https://www.materiamedica.info/en/materia-medica/john-henry-clarke/"

st.set_page_config(layout="wide", page_title="Medical CRM", page_icon="💊")

# --- STYLING ---
st.markdown("""
    <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap');
    
    html, body, [data-testid="stAppViewContainer"] {
        font-family: 'Inter', sans-serif;
        background-color: #F5F2ED;
    }
    
    .stApp {
        background-color: #F5F2ED;
    }

    /* Header Styling */
    .main-header {
        background-color: white;
        padding: 1rem 2rem;
        border-bottom: 1px solid rgba(0,0,0,0.05);
        display: flex;
        align-items: center;
        gap: 1rem;
        margin: -4rem -4rem 2rem -4rem;
    }
    
    /* Card Styling */
    .custom-card {
        background-color: white;
        padding: 1.5rem;
        border-radius: 1rem;
        border: 1px solid rgba(0,0,0,0.05);
        box-shadow: 0 1px 3px rgba(0,0,0,0.02);
        margin-bottom: 1.5rem;
    }
    
    /* Remedy Card */
    .remedy-card {
        padding: 10px;
        border-radius: 12px;
        border: 1px solid #e5e7eb;
        margin-bottom: 8px;
        transition: all 0.2s;
    }
    .available { background-color: #ecfdf5; border-color: #10b981; }
    .unavailable { background-color: #fef2f2; border-color: #fee2e2; opacity: 0.5; }
    
    .remedy-name { font-weight: 600; font-size: 13px; color: #1a1a1a; }
    .remedy-meta { font-family: monospace; font-size: 9px; color: #6b7280; text-transform: uppercase; }
    
    /* Buttons */
    .stButton>button {
        border-radius: 0.75rem;
        font-weight: 500;
    }
    
    /* Sidebar */
    [data-testid="stSidebar"] {
        background-color: #064e3b;
        color: white;
    }
    [data-testid="stSidebar"] * {
        color: white !important;
    }
    </style>
    """, unsafe_allow_html=True)

# --- STATE MANAGEMENT ---
if 'current_patient' not in st.session_state:
    st.session_state.current_patient = None
if 'visit_history' not in st.session_state:
    st.session_state.visit_history = []
if 'remedies_df' not in st.session_state:
    st.session_state.remedies_df = pd.DataFrame()
if 'prescription_text' not in st.session_state:
    st.session_state.prescription_text = ""

# --- FUNCTIONS ---
def get_col_val(row, *keys):
    for k in keys:
        matches = [c for c in row.index if k.lower().strip() in c.lower().strip()]
        if matches: return row[matches[0]]
    return ""

def load_remedies():
    try:
        # Use the export URL to get CSV
        url = REMEDY_SHEET_URL
        df = pd.read_csv(url)
        st.session_state.remedies_df = df
        return True
    except Exception as e:
        st.error(f"Error loading remedies: {e}")
        return False

def search_patient(phone):
    if not APPS_SCRIPT_URL:
        st.sidebar.error("⚠️ Apps Script URL Required")
        return
    try:
        resp = requests.get(f"{APPS_SCRIPT_URL}?action=getPatient&phone={phone}")
        data = resp.json()
        if data.get('status') == 'success':
            st.session_state.current_patient = data['patient']
            st.session_state.visit_history = data['history']
            return True
        else:
            st.session_state.current_patient = None
            st.session_state.visit_history = []
            st.info("Patient not found. Please register.")
            return False
    except Exception as e:
        st.error(f"Connection error: {e}")

def save_patient(data):
    if not APPS_SCRIPT_URL: return
    try:
        requests.post(APPS_SCRIPT_URL, json={"action": "savePatient", "data": data})
        st.session_state.current_patient = data
        st.success("Patient saved to Google Sheets")
    except Exception as e:
        st.error(f"Save error: {e}")

def save_visit(data):
    if not APPS_SCRIPT_URL: return
    try:
        requests.post(APPS_SCRIPT_URL, json={"action": "saveVisit", "data": data})
        st.success("Consultation completed and saved!")
        # Reset
        st.session_state.current_patient = None
        st.session_state.visit_history = []
        st.session_state.prescription_text = ""
        st.rerun()
    except Exception as e:
        st.error(f"Save error: {e}")

# --- UI LAYOUT ---
with st.sidebar:
    st.title("Settings")
    st.markdown("""
    **Database Connection**
    The Apps Script URL is the bridge to your Google Sheet. 
    Without it, saving/loading patients won't work.
    """)
    
    # Pre-populate if possible or show clearly
    new_url = st.text_input("Apps Script URL", value=APPS_SCRIPT_URL, type="password", help="Paste the URL from 'Deploy > Web App' in Google Sheets")
    if new_url != APPS_SCRIPT_URL:
        st.session_state.apps_script_url = new_url
        
    st.divider()
    st.markdown("### Remedy Sync")
    if st.button("🔄 Sync from Google Sheets", use_container_width=True):
        if load_remedies():
            st.success(f"Loaded {len(st.session_state.remedies_df)} remedies")

# Header
st.markdown("""
    <div class="main-header">
        <div style="background-color: #059669; padding: 8px; border-radius: 10px; color: white;">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path><rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect><path d="M9 14h6"></path><path d="M12 11v6"></path></svg>
        </div>
        <div>
            <h2 style="margin:0; font-size: 1.25rem;">Patient CRM</h2>
            <p style="margin:0; font-size: 0.7rem; color: #6b7280; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;">Medical Management System</p>
        </div>
    </div>
""", unsafe_allow_html=True)

col_nav, col_main, col_tools = st.columns([2, 6, 4])

with col_nav:
    st.markdown("### Navigation")
    search_q = st.text_input("🔍 Search Phone #", placeholder="Enter cell number...")
    if st.button("Search Patient", use_container_width=True, variant="primary"):
        search_patient(search_q)
    
    st.divider()
    
    # Quick Info
    if st.session_state.current_patient:
        st.markdown(f"""
        <div class="custom-card" style="padding: 1rem; border-left: 4px solid #059669;">
            <p style="font-size: 0.7rem; font-weight: bold; color: #6b7280; margin: 0;">ACTIVE PATIENT</p>
            <p style="font-size: 1rem; font-weight: 600; margin: 0;">{st.session_state.current_patient['firstName']} {st.session_state.current_patient.get('lastName', '')}</p>
            <p style="font-size: 0.8rem; color: #6b7280; margin: 0;">{st.session_state.current_patient['phone']}</p>
        </div>
        """, unsafe_allow_html=True)

with col_main:
    tabs = st.tabs(["💊 Consultation", "👤 Patient Info", "📜 History"])
    
    with tabs[1]: # Patient Info
        st.markdown('<div class="custom-card">', unsafe_allow_html=True)
        st.subheader("Registration")
        with st.form("patient_form"):
            c1, c2 = st.columns(2)
            f_name = c1.text_input("First Name*", value=st.session_state.current_patient.get('firstName', '') if st.session_state.current_patient else '')
            l_name = c2.text_input("Last Name", value=st.session_state.current_patient.get('lastName', '') if st.session_state.current_patient else '')
            
            <c3, c4 = st.columns(2)
            sex = c3.selectbox("Sex*", ["Male", "Female", "Other"], index=0)
            city = c4.text_input("City*", value=st.session_state.current_patient.get('city', '') if st.session_state.current_patient else '')
            
            c5, c6 = st.columns(2)
            dob = c5.date_input("Date of Birth", value=datetime.datetime.strptime(st.session_state.current_patient.get('dob'), '%Y-%m-%d').date() if st.session_state.current_patient and st.session_state.current_patient.get('dob') else None)
            age = c6.number_input("Age (if DOB unknown)", min_value=0, max_value=120, value=int(st.session_state.current_patient.get('age', 0)) if st.session_state.current_patient else 0)

            phone = st.text_input("Phone*", value=st.session_state.current_patient.get('phone', '') if st.session_state.current_patient else search_q)
            
            if st.form_submit_button("Save Patient Record", use_container_width=True):
                save_patient({
                    "phone": phone,
                    "firstName": f_name,
                    "lastName": l_name,
                    "sex": sex,
                    "city": city,
                    "state": "CA",
                    "dob": str(dob) if dob else "",
                    "age": age
                })
        st.markdown('</div>', unsafe_allow_html=True)

    with tabs[0]: # Consultation
        if st.session_state.current_patient:
            st.markdown('<div class="custom-card">', unsafe_allow_html=True)
            st.subheader("New Consultation")
            
            c1, c2 = st.columns([1, 2])
            v_date = c1.date_input("Date", datetime.date.today())
            v_symptoms = st.text_area("Symptoms (DATE; Symptoms)", value=f"{v_date}; ", height=100)
            v_diagnosis = st.text_area("Diagnosis", height=68)
            
            # Prescription
            v_prescription = st.text_area("Prescription", value=st.session_state.prescription_text, height=100, help="Search remedies on the right to add them here")
            st.session_state.prescription_text = v_prescription
            
            if st.button("✅ Complete Consultation", use_container_width=True):
                save_visit({
                    "patientPhone": st.session_state.current_patient['phone'],
                    "date": str(v_date),
                    "symptoms": v_symptoms,
                    "diagnosis": v_diagnosis,
                    "prescription": v_prescription
                })
            st.markdown('</div>', unsafe_allow_html=True)
        else:
            st.warning("Please search or register a patient first.")

    with tabs[2]: # History
        st.subheader("Visit History")
        if not st.session_state.visit_history:
            st.info("No previous visits found.")
        else:
            for visit in st.session_state.visit_history:
                with st.expander(f"📅 {visit['date']}"):
                    st.markdown(f"""
                    <div style="font-size: 0.85rem;">
                        <p><b>Symptoms:</b> {visit['symptoms']}</p>
                        <p><b>Prescription:</b> <code style="color: #065f46;">{visit['prescription']}</code></p>
                    </div>
                    """, unsafe_allow_html=True)
                    if st.button("Repeat Prescription", key=f"rep_{visit['date']}"):
                        st.session_state.prescription_text = visit['prescription']
                        st.rerun()

with col_tools:
    st.markdown('<div class="custom-card" style="height: 450px; overflow: hidden; display: flex; flex-direction: column;">', unsafe_allow_html=True)
    st.subheader("Remedy Finder")
    
    # Search logic
    search_term = ""
    if st.session_state.prescription_text:
        parts = st.session_state.prescription_text.split(",")
        search_term = parts[-1].strip()

    if not st.session_state.remedies_df.empty:
        if search_term:
            # Fuzzy column matching
            name_col = [c for c in st.session_state.remedies_df.columns if 'name' in c.lower()][0]
            
            results = st.session_state.remedies_df[
                st.session_state.remedies_df[name_col].str.contains(search_term, case=False, na=False)
            ].head(15)
            
            if results.empty:
                st.caption("No matches found.")
            
            for _, row in results.iterrows():
                r_name = get_col_val(row, 'Remedy Name', 'Name')
                r_potency = get_col_val(row, 'Potency')
                r_box = get_col_val(row, 'BOX Number', 'Box')
                r_avail = str(get_col_val(row, 'Available y/n', 'Available')).lower().strip()
                
                is_avail = r_avail in ['y', 'yes', '1', 'available', 'true']
                status_class = "available" if is_avail else "unavailable"
                
                c1, c2 = st.columns([4, 1])
                c1.markdown(f"""
                    <div class="remedy-card {status_class}">
                        <div class="remedy-name">{r_name}</div>
                        <div class="remedy-meta">{r_potency} • BOX {r_box}</div>
                    </div>
                """, unsafe_allow_html=True)
                
                if is_avail:
                    if c2.button("➕", key=f"add_{r_name}_{r_potency}"):
                        current = st.session_state.prescription_text
                        parts = current.split(",")
                        remedy_str = f"{r_name} {r_potency}"
                        
                        if parts and parts[-1].strip():
                            parts[-1] = f" {remedy_str}"
                        else:
                            parts.append(f" {remedy_str}")
                            
                        st.session_state.prescription_text = ",".join(parts).strip() + ", "
                        st.rerun()
        else:
            st.caption("Type in prescription box to search...")
    else:
        st.info("Sync remedies from sidebar first.")
    st.markdown('</div>', unsafe_allow_html=True)
    
    st.markdown('<div class="custom-card" style="height: 400px; padding: 0; overflow: hidden;">', unsafe_allow_html=True)
    st.markdown('<p style="padding: 10px 15px; margin: 0; font-size: 0.7rem; font-weight: bold; background: #f9fafb; border-bottom: 1px solid #eee;">MATERIA MEDICA</p>', unsafe_allow_html=True)
    st.components.v1.iframe(MATERIA_MEDICA_BASE, height=360, scrolling=True)
    st.markdown('</div>', unsafe_allow_html=True)
