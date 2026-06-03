import { useState, useEffect } from "react";
import axios from "axios";
import './App.css';

const API = import.meta.env.VITE_API_URL;

function App() {
  const [plants, setPlants] = useState([]);
    // tracks which plant is currently being edited (null = none)
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [form, setForm] = useState({
      name: "",
      species: "",
      cultivar: "",
      lore: "",
      careInstructions: "",
      watchFor: "",
    });

  const fetchPlants = async () => {
    const res = await axios.get(`${API}/plants`);
    setPlants(res.data);
  };

useEffect(() => {
    const loadPlants = async () => {
      await fetchPlants();
    };
    loadPlants();
  }, []);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleAddPlant = async () => {
    await axios.post(`${API}/plants`, form);
    setForm({ name: "", species: "", cultivar: "", lore: "", careInstructions: "" });
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

 return (
    <main>

      {/* ── Page Header ── */}
      <header className="site-header">
        <span className="site-eyebrow">// ROOTED_UPRIGHT™</span>
        <h1 className="site-title">Plant Management System</h1>
        <span className="site-version">v0.1.0</span>
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
                    <button className="btn-magenta-sm">Log_Care</button>
                  </div>
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