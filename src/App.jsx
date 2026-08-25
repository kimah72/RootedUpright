import { useState, useEffect, useCallback } from "react";
import { useAuth } from "react-oidc-context";
import axios from "axios";
import "./App.css";
import { appUrl } from "./config.js";

const API = import.meta.env.VITE_API_URL;

// ── Action-row icons — outline style, decorative only (buttons carry the label) ──
const iconProps = {
  width: 14,
  height: 14,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
};

const IconEdit = () => (
  <svg {...iconProps}>
    <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
  </svg>
);

const IconLog = () => (
  <svg {...iconProps}>
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
);

const IconTrash = () => (
  <svg {...iconProps}>
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    <line x1="10" y1="11" x2="10" y2="17" />
    <line x1="14" y1="11" x2="14" y2="17" />
  </svg>
);

const IconWarning = () => (
  <svg {...iconProps} fill="none" width="12" height="12">
    <path d="M12 3 2 20h20L12 3z" />
    <line x1="12" y1="9" x2="12" y2="14" />
    <circle cx="12" cy="17" r="0.6" fill="currentColor" stroke="none" />
  </svg>
);

// a plant with no care log (or none in this many days) needs attention
const ATTENTION_THRESHOLD_DAYS = 14;

function App() {
  // Cognito auth hook
  const auth = useAuth();

  // sign out via Cognito hosted UI
  const signOutRedirect = () => {
    const clientId = "3isil38pk3rjglpvp0vse9q764";
    const logoutUri = appUrl;
    const cognitoDomain =
      "https://us-east-1yhc7cmv1o.auth.us-east-1.amazoncognito.com";
    auth.removeUser();
    window.location.href = `${cognitoDomain}/logout?client_id=${clientId}&logout_uri=${encodeURIComponent(logoutUri)}`;
  };

  const [plants, setPlants] = useState([]);
  // tracks which plant is currently being edited (null = none)
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  // new photo staged for the plant being edited (not uploaded until Save)
  const [editImageFile, setEditImageFile] = useState(null);
  const [editImagePreview, setEditImagePreview] = useState(null);

  // catalog toolbar — grid/list layout and text search
  const [viewMode, setViewMode] = useState("grid");
  const [search, setSearch] = useState("");

  // tracks which plant is logging care (null = none)
  const [loggingId, setLoggingId] = useState(null);
  const [careForm, setCareForm] = useState({
    careType: "",
    notes: "",
  });

  // tracks which plant's care log is expanded (null = none)
  const [viewingLogsId, setViewingLogsId] = useState(null);
  const [careLogs, setCareLogs] = useState([]);

  // care logs per plantId, loaded alongside the catalog so the "needs
  // attention" grouping has real history to work from
  const [careLogsByPlant, setCareLogsByPlant] = useState({});
  // snapshot of "now" for the attention calculation below — captured
  // alongside the fetches rather than read via Date.now() during render,
  // since render must stay pure
  const [now, setNow] = useState(() => Date.now());

  // full-size photo currently open in the lightbox (null = closed)
  const [lightboxPlant, setLightboxPlant] = useState(null);

  // close the lightbox on Escape
  useEffect(() => {
    if (!lightboxPlant) return;
    const onKeyDown = (e) => {
      if (e.key === "Escape") setLightboxPlant(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [lightboxPlant]);

  // tracks which specimen cards have their full lore/care/watch text expanded —
  // cards stay compact by default so the grid/list stays uniform, and only
  // grow on request
  const [expandedIds, setExpandedIds] = useState(() => new Set());
  const toggleExpanded = (plantId) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(plantId)) next.delete(plantId);
      else next.add(plantId);
      return next;
    });
  };

  const [form, setForm] = useState({
    name: "",
    species: "",
    cultivar: "",
    lore: "",
    careInstructions: "",
    watchFor: "",
  });
  // photo staged for a brand-new plant (uploaded once the plant record exists)
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);

  // fetches every listed plant's care history in parallel, for the "needs
  // attention" grouping
  const fetchCareLogsForPlants = useCallback(async (plantList) => {
    const entries = await Promise.all(
      plantList.map(async (plant) => {
        try {
          const res = await axios.get(
            `${API}/carelogs?plantId=${plant.plantId}`,
          );
          return [plant.plantId, res.data];
        } catch {
          return [plant.plantId, []];
        }
      }),
    );
    setCareLogsByPlant(Object.fromEntries(entries));
    setNow(Date.now());
  }, []);

  // refetches just one plant's care history — used after logging/deleting a
  // care log so its attention status updates without re-fetching everyone
  const refreshCareLogsForPlant = useCallback(async (plantId) => {
    const res = await axios.get(`${API}/carelogs?plantId=${plantId}`);
    setCareLogsByPlant((prev) => ({ ...prev, [plantId]: res.data }));
    setNow(Date.now());
  }, []);

  const fetchPlants = useCallback(async () => {
    const userId = auth.user?.profile.sub;
    console.log("My userId:", userId);
    const res = await axios.get(`${API}/plants?userId=${userId}`);
    setPlants(res.data);
    fetchCareLogsForPlants(res.data);
  }, [auth.user, fetchCareLogsForPlants]);

  useEffect(() => {
    const loadPlants = async () => {
      await fetchPlants();
    };
    if (auth.user) {
      loadPlants();
    }
  }, [auth.user, fetchPlants]);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  // requests a presigned S3 PUT url for a plant photo, uploads the file to it,
  // and returns the public imageUrl (or null if anything fails, so callers can
  // still save the plant without a photo)
  const uploadImage = async (plantId, file) => {
    try {
      const fileType = file.name.split(".").pop().toLowerCase() || "jpg";
      const { data } = await axios.post(`${API}/upload-url`, {
        plantId,
        fileType,
      });
      await axios.put(data.uploadUrl, file, {
        headers: { "Content-Type": file.type || `image/${fileType}` },
      });
      return data.imageUrl;
    } catch (err) {
      console.error("Photo upload failed:", err);
      return null;
    }
  };

  const handleImagePick = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const handleAddPlant = async () => {
    const res = await axios.post(`${API}/plants`, {
      ...form,
      userId: auth.user?.profile.sub,
    });

    // photo upload needs the plantId, so it happens as a follow-up PUT —
    // updatePlant requires every field, so the full form is resent
    if (imageFile) {
      const imageUrl = await uploadImage(res.data.plantId, imageFile);
      if (imageUrl) {
        await axios.put(`${API}/plants`, {
          plantId: res.data.plantId,
          ...form,
          imageUrl,
        });
      }
    }

    setForm({
      name: "",
      species: "",
      cultivar: "",
      lore: "",
      careInstructions: "",
      watchFor: "",
    });
    setImageFile(null);
    setImagePreview(null);
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
      imageUrl: plant.imageUrl || "",
    });
    setEditImageFile(null);
    setEditImagePreview(null);
  };

  const handleEditImagePick = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setEditImageFile(file);
    setEditImagePreview(URL.createObjectURL(file));
  };

  // save edits back to DynamoDB via the update Lambda — every field is sent,
  // since updatePlant overwrites the whole item rather than patching it
  const handleEditSave = async (plantId) => {
    let imageUrl = editForm.imageUrl;
    if (editImageFile) {
      const uploaded = await uploadImage(plantId, editImageFile);
      if (uploaded) imageUrl = uploaded;
    }
    await axios.put(`${API}/plants`, { plantId, ...editForm, imageUrl });
    setEditingId(null);
    setEditImageFile(null);
    setEditImagePreview(null);
    fetchPlants();
  };

  // remove a plant from the catalog
  const handleDeletePlant = async (plantId) => {
    await axios.delete(`${API}/plants`, { data: { plantId } });
    fetchPlants();
  };

  // most recent first — logId is a random id, not chronological, so
  // dateLogged is the only reliable sort key
  const sortByDateLogged = (logs) =>
    [...logs].sort(
      (a, b) => new Date(b.dateLogged) - new Date(a.dateLogged),
    );

  // remove a single care log entry and refresh its timeline
  const handleDeleteCareLog = async (logId, plantId) => {
    await axios.delete(`${API}/carelogs`, { data: { logId, plantId } });
    const res = await axios.get(`${API}/carelogs?plantId=${plantId}`);
    setCareLogs(sortByDateLogged(res.data));
    refreshCareLogsForPlant(plantId);
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
    refreshCareLogsForPlant(plantId);
  };

  // fetch care logs for a specific plant and toggle the timeline view
  const handleViewLogs = async (plantId) => {
    if (viewingLogsId === plantId) {
      setViewingLogsId(null);
      setCareLogs([]);
      return;
    }
    const res = await axios.get(`${API}/carelogs?plantId=${plantId}`);
    setCareLogs(sortByDateLogged(res.data));
    setViewingLogsId(plantId);
  };

  // catalog search — matches name, species, or cultivar, case-insensitive
  const term = search.trim().toLowerCase();
  const filteredPlants = term
    ? plants.filter((plant) =>
        [plant.name, plant.species, plant.cultivar].some((field) =>
          field?.toLowerCase().includes(term),
        ),
      )
    : plants;

  // most recent dateLogged for a plant, or null if it has no care history
  const lastCaredDate = (plantId) => {
    const logs = careLogsByPlant[plantId];
    if (!logs || logs.length === 0) return null;
    return logs.reduce((latest, log) => {
      const logged = new Date(log.dateLogged);
      return !latest || logged > latest ? logged : latest;
    }, null);
  };

  // true if a plant has never been logged, or not within the threshold
  const needsAttention = (plantId) => {
    const lastCared = lastCaredDate(plantId);
    if (!lastCared) return true;
    const daysSince = (now - lastCared.getTime()) / 86400000;
    return daysSince >= ATTENTION_THRESHOLD_DAYS;
  };

  const attentionPlants = filteredPlants.filter((p) =>
    needsAttention(p.plantId),
  );
  const restPlants = filteredPlants.filter(
    (p) => !needsAttention(p.plantId),
  );

  // renders one specimen card — shared by both the "needs attention" and
  // "all specimens" groups so the two lists don't duplicate ~400 lines of JSX
  const renderPlantCard = (plant) => {
    const attention = needsAttention(plant.plantId);
    return (
      <div
        key={plant.plantId}
        className={`plant-card ${viewMode === "list" ? "card-list" : ""} ${editingId === plant.plantId ? "card-editing" : ""} ${attention ? "card-attention" : ""}`}
      >
        {/* top accent bar */}
        <div className="card-accent" />

        {/* corner brackets */}
        <div className="bracket-tl" />
        <div className="bracket-br" />

        {/* photo — falls back to a placeholder slot when none is set;
            click to open full-size */}
        <div className="card-media">
          {plant.imageUrl ? (
            <button
              type="button"
              className="card-media-open"
              onClick={() => setLightboxPlant(plant)}
              aria-label={`View full-size photo of ${plant.name || "specimen"}`}
            >
              <img src={plant.imageUrl} alt={plant.name || "specimen photo"} />
            </button>
          ) : (
            <div className="card-media-placeholder">NO_IMAGE</div>
          )}
        </div>

        <div className="card-body">
        {/* specimen label */}
        <p className="card-eyebrow">SPECIMEN_FILE</p>

        {/* ── Edit Mode ── */}
        {editingId === plant.plantId ? (
          <div className="edit-form">
            <div className="field-group">
              <label
                className="field-label"
                htmlFor={`edit-name-${plant.plantId}`}
              >
                Plant Name
              </label>
              <input
                className="field"
                id={`edit-name-${plant.plantId}`}
                value={editForm.name}
                onChange={(e) =>
                  setEditForm({ ...editForm, name: e.target.value })
                }
              />
            </div>
            <div className="field-group">
              <label
                className="field-label"
                htmlFor={`edit-species-${plant.plantId}`}
              >
                Species
              </label>
              <input
                className="field"
                id={`edit-species-${plant.plantId}`}
                value={editForm.species}
                onChange={(e) =>
                  setEditForm({ ...editForm, species: e.target.value })
                }
              />
            </div>
            <div className="field-group">
              <label
                className="field-label"
                htmlFor={`edit-cultivar-${plant.plantId}`}
              >
                Cultivar
              </label>
              <input
                className="field"
                id={`edit-cultivar-${plant.plantId}`}
                value={editForm.cultivar}
                onChange={(e) =>
                  setEditForm({ ...editForm, cultivar: e.target.value })
                }
              />
            </div>
            <div className="field-group">
              <label
                className="field-label"
                htmlFor={`edit-lore-${plant.plantId}`}
              >
                Lore
              </label>
              <input
                className="field"
                id={`edit-lore-${plant.plantId}`}
                value={editForm.lore}
                onChange={(e) =>
                  setEditForm({ ...editForm, lore: e.target.value })
                }
              />
            </div>
            <div className="field-group">
              <label
                className="field-label"
                htmlFor={`edit-care-${plant.plantId}`}
              >
                Care Instructions
              </label>
              <input
                className="field"
                id={`edit-care-${plant.plantId}`}
                value={editForm.careInstructions}
                onChange={(e) =>
                  setEditForm({
                    ...editForm,
                    careInstructions: e.target.value,
                  })
                }
              />
            </div>
            <div className="field-group">
              <label
                className="field-label"
                htmlFor={`edit-watchFor-${plant.plantId}`}
              >
                Watch For
              </label>
              <input
                className="field"
                id={`edit-watchFor-${plant.plantId}`}
                value={editForm.watchFor || ""}
                onChange={(e) =>
                  setEditForm({ ...editForm, watchFor: e.target.value })
                }
              />
            </div>
            <div className="field-group">
              <label
                className="field-label"
                htmlFor={`edit-photo-${plant.plantId}`}
              >
                Photo
              </label>
              <div className="photo-picker">
                <label
                  className="btn-lime-sm photo-picker-btn"
                  htmlFor={`edit-photo-${plant.plantId}`}
                >
                  Choose_File
                </label>
                <input
                  className="photo-picker-input"
                  type="file"
                  id={`edit-photo-${plant.plantId}`}
                  accept="image/*"
                  onChange={handleEditImagePick}
                />
                <span className="photo-picker-name">
                  {editImageFile
                    ? editImageFile.name
                    : editForm.imageUrl
                      ? "current photo kept"
                      : "no file selected"}
                </span>
              </div>
              {editImagePreview && (
                <img
                  className="photo-preview"
                  src={editImagePreview}
                  alt="Selected specimen preview"
                />
              )}
            </div>
            <div className="card-actions">
              <button
                className="btn-lime-sm"
                onClick={() => handleEditSave(plant.plantId)}
              >
                Save
              </button>
              <button
                className="btn-amber-sm"
                onClick={() => setEditingId(null)}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          /* ── Display Mode ── */
          <>
            <h2 className="card-name">
              {attention && (
                <span className="attention-flag" title="Needs attention">
                  <IconWarning />
                </span>
              )}
              {plant.name}
            </h2>
            <p className="card-species">{plant.species}</p>
            {plant.cultivar && (
              <p className="card-cultivar">{plant.cultivar}</p>
            )}

            <div className="card-divider" />

            {(() => {
              const isExpanded = expandedIds.has(plant.plantId);
              // only offer an expand toggle when there's enough text
              // to actually be worth collapsing
              const contentLength = [
                plant.lore,
                plant.careInstructions,
                plant.watchFor,
              ]
                .filter(Boolean)
                .join(" ").length;
              const isLong = contentLength > 140;

              return (
                <>
                  <div
                    className={`card-meta ${
                      isLong && !isExpanded ? "card-meta-collapsed" : ""
                    }`}
                  >
                    {plant.lore && (
                      <div className="card-meta-row">
                        <span className="meta-label">LORE</span>
                        <span className="meta-value lore-value">
                          {plant.lore}
                        </span>
                      </div>
                    )}

                    <div className="card-meta-row">
                      <span className="meta-label">CARE</span>
                      <span className="meta-value">
                        {plant.careInstructions}
                      </span>
                    </div>

                    {plant.watchFor && (
                      <div className="card-meta-row">
                        <span className="meta-label">WATCH</span>
                        <span className="meta-value">
                          {plant.watchFor}
                        </span>
                      </div>
                    )}
                  </div>
                  {isLong && (
                    <button
                      type="button"
                      className="card-expand-toggle"
                      onClick={() => toggleExpanded(plant.plantId)}
                    >
                      {isExpanded ? "// COLLAPSE" : "// EXPAND"}
                    </button>
                  )}
                </>
              );
            })()}

            {/* primary action gets its own row — it's what most visits are for */}
            <div className="card-actions-primary">
              <button
                className="btn-amber care-cta"
                onClick={() => setLoggingId(plant.plantId)}
              >
                + Log_Care
              </button>
            </div>

            {/* secondary actions — icon row, labeled for accessibility */}
            <div className="card-actions">
              <button
                className="btn-icon"
                onClick={() => handleEditOpen(plant)}
              >
                <IconEdit />
                <span>Edit</span>
              </button>
              <button
                className="btn-icon"
                aria-pressed={viewingLogsId === plant.plantId}
                onClick={() => handleViewLogs(plant.plantId)}
              >
                <IconLog />
                <span>
                  {viewingLogsId === plant.plantId
                    ? "Hide_Log"
                    : "View_Log"}
                </span>
              </button>
              <button
                className="btn-icon btn-icon-danger"
                onClick={() => {
                  if (
                    window.confirm(
                      `Delete ${plant.name || "this specimen"}? This cannot be undone.`,
                    )
                  ) {
                    handleDeletePlant(plant.plantId);
                  }
                }}
              >
                <IconTrash />
                <span>Delete</span>
              </button>
            </div>

            {/* ── Care Log Form — shows inline when Log_Care is clicked ── */}
            {loggingId === plant.plantId && (
              <div className="care-log-form">
                <div className="field-group">
                  <label
                    className="field-label"
                    htmlFor={`care-type-${plant.plantId}`}
                  >
                    Care Type
                  </label>
                  <select
                    className="field"
                    id={`care-type-${plant.plantId}`}
                    value={careForm.careType}
                    onChange={(e) =>
                      setCareForm({
                        ...careForm,
                        careType: e.target.value,
                      })
                    }
                  >
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
                  <label
                    className="field-label"
                    htmlFor={`care-notes-${plant.plantId}`}
                  >
                    Notes
                  </label>
                  <input
                    className="field"
                    id={`care-notes-${plant.plantId}`}
                    placeholder="what happened..."
                    value={careForm.notes}
                    onChange={(e) =>
                      setCareForm({ ...careForm, notes: e.target.value })
                    }
                  />
                </div>
                <div className="card-actions">
                  <button
                    className="btn-amber-sm"
                    onClick={() => handleLogCare(plant.plantId)}
                  >
                    Save_Log
                  </button>
                  <button
                    className="btn-lime-sm"
                    onClick={() => setLoggingId(null)}
                  >
                    Cancel
                  </button>
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
                        <div
                          className={`timeline-dot ${log.careType === "Drama" ? "dot-amber" : "dot-lime"}`}
                        />
                        <div className="timeline-content">
                          <span className="timeline-type">
                            {log.careType}
                          </span>
                          <span className="timeline-date">
                            {new Date(
                              log.dateLogged,
                            ).toLocaleDateString()}
                          </span>
                          {log.notes && (
                            <p className="timeline-notes">{log.notes}</p>
                          )}
                          <button
                            className="btn-amber-sm"
                            onClick={() =>
                              handleDeleteCareLog(
                                log.logId,
                                plant.plantId,
                              )
                            }
                          >
                            Delete
                          </button>
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
      </div>
    );
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
          <button className="btn-amber-sm" onClick={signOutRedirect}>
            Sign_Out
          </button>
        </div>
      </header>

      <div className="site-divider" />

      {/* ── Add Plant Form ── */}
      <section className="add-plant-section">
        <p className="section-label">// ADD_SPECIMEN</p>
        <div className="add-plant-form">
          <div className="field-group">
            <label className="field-label" htmlFor="name">
              Plant Name
            </label>
            <input
              className="field"
              id="name"
              name="name"
              placeholder="plant name"
              value={form.name}
              onChange={handleChange}
            />
          </div>
          <div className="field-group">
            <label className="field-label" htmlFor="species">
              Species
            </label>
            <input
              className="field"
              id="species"
              name="species"
              placeholder="species"
              value={form.species}
              onChange={handleChange}
            />
          </div>
          <div className="field-group">
            <label className="field-label" htmlFor="cultivar">
              Cultivar
            </label>
            <input
              className="field"
              id="cultivar"
              name="cultivar"
              placeholder="variety / cultivar"
              value={form.cultivar}
              onChange={handleChange}
            />
          </div>
          <div className="field-group">
            <label className="field-label" htmlFor="lore">
              Lore
            </label>
            <input
              className="field"
              id="lore"
              name="lore"
              placeholder="origin story..."
              value={form.lore}
              onChange={handleChange}
            />
          </div>
          <div className="field-group">
            <label className="field-label" htmlFor="careInstructions">
              Care Instructions
            </label>
            <input
              className="field"
              id="careInstructions"
              name="careInstructions"
              placeholder="care instructions"
              value={form.careInstructions}
              onChange={handleChange}
            />
          </div>
          <div className="field-group">
            <label className="field-label" htmlFor="watchFor">
              Watch For
            </label>
            <input
              className="field"
              id="watchFor"
              name="watchFor"
              placeholder="warning signs..."
              value={form.watchFor}
              onChange={handleChange}
            />
          </div>
          <div className="field-group">
            <label className="field-label" htmlFor="photo">
              Photo
            </label>
            <div className="photo-picker">
              <label className="btn-lime-sm photo-picker-btn" htmlFor="photo">
                Choose_File
              </label>
              <input
                className="photo-picker-input"
                type="file"
                id="photo"
                accept="image/*"
                onChange={handleImagePick}
              />
              <span className="photo-picker-name">
                {imageFile ? imageFile.name : "no file selected"}
              </span>
            </div>
          </div>
        </div>
        {imagePreview && (
          <img
            className="photo-preview"
            src={imagePreview}
            alt="Selected specimen preview"
          />
        )}
        <div className="form-submit">
          <button className="btn-lime" onClick={handleAddPlant}>
            Add_Specimen
          </button>
        </div>
      </section>

      <div className="site-divider" />

      {/* ── Plant Catalog ── */}
      <section className="catalog-section">
        <div className="catalog-toolbar">
          <p className="section-label">// SPECIMEN_CATALOG</p>
          <div className="toolbar-controls">
            <input
              className="field search-field"
              type="search"
              placeholder="search name / species / cultivar..."
              aria-label="Search specimens"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <div className="view-toggle" role="group" aria-label="Catalog layout">
              <button
                className={`view-toggle-btn ${viewMode === "grid" ? "view-toggle-active" : ""}`}
                aria-pressed={viewMode === "grid"}
                onClick={() => setViewMode("grid")}
              >
                Grid
              </button>
              <button
                className={`view-toggle-btn ${viewMode === "list" ? "view-toggle-active" : ""}`}
                aria-pressed={viewMode === "list"}
                onClick={() => setViewMode("list")}
              >
                List
              </button>
            </div>
          </div>
        </div>
        <div className={`plant-grid ${viewMode === "list" ? "plant-grid-list" : ""}`}>
          {filteredPlants.length === 0 && (
            <p className="catalog-empty">
              {plants.length === 0
                ? "no specimens catalogued yet"
                : "no specimens match your search"}
            </p>
          )}

          {attentionPlants.length > 0 && (
            <p className="group-header group-header-attention">
              // NEEDS_ATTENTION ({attentionPlants.length})
            </p>
          )}
          {attentionPlants.map(renderPlantCard)}

          {attentionPlants.length > 0 && restPlants.length > 0 && (
            <p className="group-header group-header-all">
              // ALL_SPECIMENS
            </p>
          )}
          {restPlants.map(renderPlantCard)}
        </div>
      </section>

      {/* ── Photo Lightbox ── */}
      {lightboxPlant && (
        <div
          className="lightbox-overlay"
          role="dialog"
          aria-modal="true"
          aria-label={`${lightboxPlant.name || "Specimen"} photo`}
          onClick={() => setLightboxPlant(null)}
        >
          <button
            type="button"
            className="lightbox-close"
            onClick={() => setLightboxPlant(null)}
            aria-label="Close"
          >
            ×
          </button>
          <img
            className="lightbox-image"
            src={lightboxPlant.imageUrl}
            alt={lightboxPlant.name || "specimen photo"}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </main>
  );
}

export default App;
