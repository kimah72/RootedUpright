import { useState, useEffect } from "react";
import { useAuth } from "react-oidc-context";
import axios from "axios";
import './App.css';

const API = import.meta.env.VITE_API_URL;

function App() {

  // Cognito auth hook
  const auth = useAuth();

  // sign out via Cognito hosted UI
  const signOutRedirect = () => {
    const clientId = "3isil38pk3rjglpvp0vse9q764";
    const logoutUri = "http://localhost:5174";
    const cognitoDomain = "https://us-east-1yhc7cmv1o.auth.us-east-1.amazoncognito.com";
    auth.removeUser();
    window.location.href = `${cognitoDomain}/logout?client_id=${clientId}&logout_uri=${encodeURIComponent(logoutUri)}`;
  };

  const [plants, setPlants] = useState([]);
    // tracks which plant is currently being edited (null = none)
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});

  // tracks which plant is logging care (null = none)
  const [loggingId, setLoggingId] = useState(null);
  const [careForm, setCareForm] = useState({
    careType: "",
    notes: "",
  });

  // tracks which plant's care log is expanded (null = none)
  const [viewingLogsId, setViewingLogsId] = useState(null);
  const [careLogs, setCareLogs] = useState([]);

  const [form, setForm] = useState({
      name: "",
      species: "",
      cultivar: "",
      lore: "",
      careInstructions: "",
      watchFor: "",
    });

  const fetchPlants = async () => {
    const userId = auth.user?.profile.sub;
    console.log("My userId:", userId);
    const res = await axios.get(`${API}/plants?userId=${userId}`);
    setPlants(res.data);
  };

  useEffect(() => {
      const loadPlants = async () => {
        await fetchPlants();
      };
      if (auth.user) {
        loadPlants();
      }
    }, [auth.user]);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleAddPlant = async () => {
    await axios.post(`${API}/plants`, {
      ...form,
      userId: auth.user?.profile.sub,
    });
    setForm({ name: "", species: "", cultivar: "", lore: "", careInstructions: "", watchFor: "" });
    fetchPlants();
  };

  // populate edit form and open it for the selected plant
  const handleEditOpen = (plant) => {
    setEditingId(plant.plantId);
    setEditForm({
      name: plant.name || "",
      species: plant.species || "",
      cultivar: plant.cultivar || "",
      lore: plant.lore || "",
      careInstructions: plant.careInstructions || "",
      watchFor: plant.watchFor || "",
    });
  };

  // save edits back to DynamoDB via the update Lambda
  const handleEditSave = async (plantId) => {
    await axios.put(`${API}/plants`, { plantId, ...editForm });
    setEditingId(null);
    fetchPlants();
  };

  // submit a care log entry for a plant
  const handleLogCare = async (plantId) => {
    await axios.post(`${API}/carelogs`, {
      plantId,
      careType: careForm.careType,
      notes: careForm.notes,
    });
    setLoggingId(null);
    setCareForm({ careType: "", notes: "" });
  };

  // fetch care logs for a specific plant and toggle the timeline view
  const handleViewLogs = async (plantId) => {
    if (viewingLogsId === plantId) {
      setViewingLogsId(null);
      setCareLogs([]);
      return;
    }
    const res = await axios.get(`${API}/carelogs?plantId=${plantId}`);
    setCareLogs(res.data);
    setViewingLogsId(plantId);
  };

  // show loading state while Cognito initializes
  if (auth.isLoading) {
    return <div className="auth-status">// INITIALIZING...</div>;
  }

  // show error if auth fails
  if (auth.error) {
    return <div className="auth-status">// ERROR: {auth.error.message}</div>;
  }

  // if not authenticated, show sign in screen
  if (!auth.isAuthenticated) {
    return (
      <main className="auth-screen">
        <div className="auth-card">
          <p className="site-eyebrow">// ROOTED_UPRIGHT™</p>
          <h1 className="site-title">Plant Management System</h1>
          <div className="site-divider" />
          <p className="auth-prompt">AUTHENTICATION REQUIRED</p>
          <button className="btn-lime" onClick={() => auth.signinRedirect()}>
            Sign_In
          </button>
        </div>
      </main>
    );
  }

 return (
    <main>

      {/* ── Page Header ── */}
      <header className="site-header">
        <span className="site-eyebrow">// ROOTED_UPRIGHT™</span>
        <h1 className="site-title">Plant Management System</h1>
        <div className="header-right">
          <span className="site-version">v0.1.0</span>
          <button className="btn-magenta-sm" onClick={signOutRedirect}>Sign_Out</button>
        </div>
      </header>

      <div className="site-divider" />

      {/* ── Add Plant Form ── */}
      <section className="add-plant-section">
        <p className="section-label">// ADD_SPECIMEN</p>
          <div className="add-plant-form">
            <div className="field-group">
              <label className="field-label" htmlFor="name">Plant Name</label>
              <input className="field" id="name" name="name" placeholder="plant name" value={form.name} onChange={handleChange} />
            </div>
            <div className="field-group">
              <label className="field-label" htmlFor="species">Species</label>
              <input className="field" id="species" name="species" placeholder="species" value={form.species} onChange={handleChange} />
            </div>
            <div className="field-group">
              <label className="field-label" htmlFor="cultivar">Cultivar</label>
              <input className="field" id="cultivar" name="cultivar" placeholder="variety / cultivar" value={form.cultivar} onChange={handleChange} />
            </div>
            <div className="field-group">
              <label className="field-label" htmlFor="lore">Lore</label>
              <input className="field" id="lore" name="lore" placeholder="origin story..." value={form.lore} onChange={handleChange} />
            </div>
            <div className="field-group">
              <label className="field-label" htmlFor="careInstructions">Care Instructions</label>
              <input className="field" id="careInstructions" name="careInstructions" placeholder="care instructions" value={form.careInstructions} onChange={handleChange} />
            </div>
            <div className="field-group">
              <label className="field-label" htmlFor="watchFor">Watch For</label>
              <input className="field" id="watchFor" name="watchFor" placeholder="warning signs..." value={form.watchFor} onChange={handleChange} />
            </div>
          </div>
          <div className="form-submit">
            <button className="btn-lime" onClick={handleAddPlant}>Add_Specimen</button>
          </div>
      </section>

      <div className="site-divider" />

      {/* ── Plant Catalog ── */}
      <section className="catalog-section">
        <p className="section-label">// SPECIMEN_CATALOG</p>
        <div className="plant-grid">
          {plants.map((plant) => (
            <div key={plant.plantId} className={`plant-card ${editingId === plant.plantId ? "card-editing" : ""}`}>

              {/* top accent bar */}
              <div className="card-accent" />

              {/* corner brackets */}
              <div className="bracket-tl" />
              <div className="bracket-br" />

              {/* specimen label */}
              <p className="card-eyebrow">SPECIMEN_FILE</p>

              {/* ── Edit Mode ── */}
              {editingId === plant.plantId ? (
                <div className="edit-form">
                  <div className="field-group">
                    <label className="field-label" htmlFor={`edit-name-${plant.plantId}`}>Plant Name</label>
                    <input className="field" id={`edit-name-${plant.plantId}`} value={editForm.name} onChange={(e) => setEditForm({...editForm, name: e.target.value})} />
                  </div>
                  <div className="field-group">
                    <label className="field-label" htmlFor={`edit-species-${plant.plantId}`}>Species</label>
                    <input className="field" id={`edit-species-${plant.plantId}`} value={editForm.species} onChange={(e) => setEditForm({...editForm, species: e.target.value})} />
                  </div>
                  <div className="field-group">
                    <label className="field-label" htmlFor={`edit-cultivar-${plant.plantId}`}>Cultivar</label>
                    <input className="field" id={`edit-cultivar-${plant.plantId}`} value={editForm.cultivar} onChange={(e) => setEditForm({...editForm, cultivar: e.target.value})} />
                  </div>
                  <div className="field-group">
                    <label className="field-label" htmlFor={`edit-lore-${plant.plantId}`}>Lore</label>
                    <input className="field" id={`edit-lore-${plant.plantId}`} value={editForm.lore} onChange={(e) => setEditForm({...editForm, lore: e.target.value})} />
                  </div>
                  <div className="field-group">
                    <label className="field-label" htmlFor={`edit-care-${plant.plantId}`}>Care Instructions</label>
                    <input className="field" id={`edit-care-${plant.plantId}`} value={editForm.careInstructions} onChange={(e) => setEditForm({...editForm, careInstructions: e.target.value})} />
                  </div>
                  <div className="field-group">
                    <label className="field-label" htmlFor={`edit-watchFor-${plant.plantId}`}>Watch For</label>
                    <input className="field" id={`edit-watchFor-${plant.plantId}`} value={editForm.watchFor || ""} onChange={(e) => setEditForm({...editForm, watchFor: e.target.value})} />
                  </div>
                  <div className="card-actions">
                    <button className="btn-lime-sm" onClick={() => handleEditSave(plant.plantId)}>Save</button>
                    <button className="btn-magenta-sm" onClick={() => setEditingId(null)}>Cancel</button>
                  </div>
                </div>

              ) : (

                /* ── Display Mode ── */
                <>
                  <h2 className="card-name">{plant.name}</h2>
                  <p className="card-species">{plant.species}</p>
                  {plant.cultivar && (
                    <p className="card-cultivar">{plant.cultivar}</p>
                  )}

                  <div className="card-divider" />

                  {plant.lore && (
                    <div className="card-meta-row">
                      <span className="meta-label">LORE</span>
                      <span className="meta-value lore-value">{plant.lore}</span>
                    </div>
                  )}

                  <div className="card-meta-row">
                    <span className="meta-label">CARE</span>
                    <span className="meta-value">{plant.careInstructions}</span>
                  </div>

                  {plant.watchFor && (
                    <div className="card-meta-row">
                      <span className="meta-label">WATCH</span>
                      <span className="meta-value">{plant.watchFor}</span>
                    </div>
                  )}

                  <div className="card-actions">
                    <button className="btn-lime-sm" onClick={() => handleEditOpen(plant)}>Edit</button>
                    <button className="btn-lime-sm" onClick={() => handleViewLogs(plant.plantId)}>
                      {viewingLogsId === plant.plantId ? "Hide_Log" : "View_Log"}
                    </button>
                    <button className="btn-magenta-sm" onClick={() => setLoggingId(plant.plantId)}>Log_Care</button>
                  </div>

                  {/* ── Care Log Form — shows inline when Log_Care is clicked ── */}
                  {loggingId === plant.plantId && (
                    <div className="care-log-form">
                      <div className="field-group">
                        <label className="field-label" htmlFor={`care-type-${plant.plantId}`}>Care Type</label>
                        <select className="field" id={`care-type-${plant.plantId}`} value={careForm.careType} onChange={(e) => setCareForm({...careForm, careType: e.target.value})}>
                          <option value="">select type...</option>
                          <option value="Watering">Watering</option>
                          <option value="Fertilizing">Fertilizing</option>
                          <option value="Repotting">Repotting</option>
                          <option value="Pruning">Pruning</option>
                          <option value="Leaf Cleaning">Leaf Cleaning</option>
                          <option value="Drama">Drama ⚠</option>
                          <option value="Other">Other</option>
                        </select>
                      </div>
                      <div className="field-group">
                        <label className="field-label" htmlFor={`care-notes-${plant.plantId}`}>Notes</label>
                        <input className="field" id={`care-notes-${plant.plantId}`} placeholder="what happened..." value={careForm.notes} onChange={(e) => setCareForm({...careForm, notes: e.target.value})} />
                      </div>
                      <div className="card-actions">
                        <button className="btn-magenta-sm" onClick={() => handleLogCare(plant.plantId)}>Save_Log</button>
                        <button className="btn-lime-sm" onClick={() => setLoggingId(null)}>Cancel</button>
                      </div>
                    </div>
                  )}

                  {/* ── Care Log Timeline ── */}
                  {viewingLogsId === plant.plantId && (
                    <div className="care-timeline">
                      <p className="timeline-label">// CARE_LOG</p>
                      {careLogs.length === 0 ? (
                        <p className="timeline-empty">no entries yet</p>
                      ) : (
                        <div className="timeline-list">
                          {careLogs.map((log) => (
                            <div key={log.logId} className="timeline-entry">
                              <div className={`timeline-dot ${log.careType === "Drama" ? "dot-magenta" : "dot-lime"}`} />
                              <div className="timeline-content">
                                <span className="timeline-type">{log.careType}</span>
                                <span className="timeline-date">{new Date(log.dateLogged).toLocaleDateString()}</span>
                                {log.notes && <p className="timeline-notes">{log.notes}</p>}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </>                
              )}
            </div>
          ))}
        </div>
      </section>

    </main>
  );
}

export default App;