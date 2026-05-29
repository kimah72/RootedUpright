import { useState, useEffect } from "react";
import axios from "axios";

const API = import.meta.env.VITE_API_URL;

function App() {
  const [plants, setPlants] = useState([]);
  const [form, setForm] = useState({
    name: "",
    species: "",
    namedAfter: "",
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
    setForm({ name: "", species: "", namedAfter: "", careInstructions: "" });
    fetchPlants();
  };

  return (
    <div>
      <h1>Rooted Upright 🌿</h1>

      <h2>Add a Plant</h2>
      <input name="name" placeholder="Name" value={form.name} onChange={handleChange} />
      <input name="species" placeholder="Species" value={form.species} onChange={handleChange} />
      <input name="namedAfter" placeholder="Named After" value={form.namedAfter} onChange={handleChange} />
      <input name="careInstructions" placeholder="Care Instructions" value={form.careInstructions} onChange={handleChange} />
      <button onClick={handleAddPlant}>Add Plant</button>

      <h2>My Plants</h2>
      {plants.map((plant) => (
        <div key={plant.plantId}>
          <h3>{plant.name}</h3>
          <p>{plant.species}</p>
          <p>Named after: {plant.namedAfter}</p>
          <p>{plant.careInstructions}</p>
        </div>
      ))}
    </div>
  );
}

export default App;