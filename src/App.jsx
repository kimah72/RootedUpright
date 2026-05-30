import { useState, useEffect } from "react";
import axios from "axios";
import './App.css';

const API = import.meta.env.VITE_API_URL;


function App() {
  const [plants, setPlants] = useState([]);
  const [form, setForm] = useState({
    name: "",
    species: "",
    lore: "",
    careInstructions: "",
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
    setForm({ name: "", species: "", lore: "", careInstructions: "" });
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
              <label className="field-label" htmlFor="lore">Lore</label>
              <input className="field" id="lore" name="lore" placeholder="every plant has a story..." value={form.lore} onChange={handleChange} />
            </div>
            <div className="field-group">
              <label className="field-label" htmlFor="careInstructions">Care Instructions</label>
              <input className="field" id="careInstructions" name="careInstructions" placeholder="care instructions" value={form.careInstructions} onChange={handleChange} />
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
            <div key={plant.plantId} className="plant-card">

              {/* top accent bar */}
              <div className="card-accent" />

              {/* corner brackets */}
              <div className="bracket-tl" />
              <div className="bracket-br" />

              {/* specimen label */}
              <p className="card-eyebrow">SPECIMEN_FILE</p>

              {/* plant name and species */}
              <h2 className="card-name">{plant.name}</h2>
              <p className="card-species">{plant.species}</p>

              <div className="card-divider" />

              {/* metadata rows */}
              {plant.lore && (
                <div className="card-meta-row">
                  <span className="meta-label">LORE</span>
                  <span className="meta-value">{plant.lore}</span>
                </div>
              )}

              <div className="card-meta-row">
                <span className="meta-label">CARE</span>
                <span className="meta-value">{plant.careInstructions}</span>
              </div>

              {/* action buttons */}
              <div className="card-actions">
                <button className="btn-lime-sm">Log_Care</button>
                <button className="btn-magenta-sm">Edit</button>
              </div>

            </div>
          ))}
        </div>
      </section>

    </main>
  );
}

export default App;