import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "react-oidc-context";
import axios from "axios";
import "./App.css";
import { appUrl } from "./config.js";

const API = import.meta.env.VITE_API_URL;

// ── Icons — outline style, decorative only (the button around each one
//    carries the accessible label) ──
const iconProps = {
  width: 20,
  height: 20,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
};

const IconEdit = () => (
  <svg {...iconProps} width="16" height="16">
    <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
  </svg>
);

const IconLog = () => (
  <svg {...iconProps} width="16" height="16">
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
);

const IconTrash = () => (
  <svg {...iconProps} width="16" height="16">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </svg>
);

const IconPlus = () => (
  <svg {...iconProps} strokeWidth="2.5">
    <path d="M12 5v14M5 12h14" />
  </svg>
);

const IconClose = () => (
  <svg {...iconProps} width="18" height="18">
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);

const IconMore = () => (
  <svg {...iconProps}>
    <circle cx="5" cy="12" r="1" />
    <circle cx="12" cy="12" r="1" />
    <circle cx="19" cy="12" r="1" />
  </svg>
);

const IconGrid = () => (
  <svg {...iconProps}>
    <rect x="3" y="3" width="7" height="7" rx="2" />
    <rect x="14" y="3" width="7" height="7" rx="2" />
    <rect x="3" y="14" width="7" height="7" rx="2" />
    <rect x="14" y="14" width="7" height="7" rx="2" />
  </svg>
);

const IconSearch = () => (
  <svg {...iconProps}>
    <circle cx="11" cy="11" r="7" />
    <path d="M20 20l-3.5-3.5" />
  </svg>
);

const IconLeaf = () => (
  <svg {...iconProps} width="36" height="36" strokeWidth="1.4">
    <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.5 19 2c1 2 2 4.2 2 8 0 5.5-4.8 10-10 10z" />
    <path d="M2 21c0-3 1.9-5.4 5.1-6" />
  </svg>
);

// a plant with no care log (or none in this many days) needs attention
const ATTENTION_THRESHOLD_DAYS = 14;

// a Drama log stays "active" (shown in magenta on the Today row) for this
// many days — long enough to keep an eye on the plant, short enough that it
// doesn't nag forever after she's recovered
const DRAMA_WINDOW_DAYS = 3;

// one list feeds both the quick picker and the timeline, so a new care type
// only has to be added in one place
const CARE_TYPES = [
  "Watering",
  "Fertilizing",
  "Repotting",
  "Pruning",
  "Leaf Cleaning",
  "Drama",
  "Other",
];

const MS_PER_DAY = 86400000;

// "today", "1 day ago", "9 days ago" — whole days, rounded down, so a log
// from this morning still reads as today
const formatDaysAgo = (days) => {
  const whole = Math.floor(days);
  if (whole <= 0) return "today";
  return whole === 1 ? "1 day ago" : `${whole} days ago`;
};

// Bottom sheet — slides up from the bottom on phones, sits centered on wide
// screens. Rendered by the parent only while open, so it needs no "open" prop.
function Sheet({ title, onClose, children }) {
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <section
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        // clicks inside the sheet must not bubble up to the backdrop,
        // or every tap on a button would also close the sheet
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet-handle" aria-hidden="true" />
        {children}
      </section>
    </div>
  );
}

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

  // catalog toolbar — grid/list layout, text search, and filter chip
  const [viewMode, setViewMode] = useState("grid");
  const [search, setSearch] = useState("");
  // "all" | "attention" | "drama" — which chip is active
  const [filter, setFilter] = useState("all");
  // the search input is focused from the bottom bar's search button
  const searchRef = useRef(null);

  // which plant the quick care picker is open for (null = closed)
  const [loggingId, setLoggingId] = useState(null);
  const [careForm, setCareForm] = useState({
    careType: "",
    notes: "",
  });

  // add-plant form now lives in a sheet behind the + button instead of
  // sitting at the top of the page on every visit
  const [addOpen, setAddOpen] = useState(false);

  // account menu (sign out) under the avatar button
  const [menuOpen, setMenuOpen] = useState(false);

  // tracks which plant's care log is expanded (null = none)
  const [viewingLogsId, setViewingLogsId] = useState(null);
  const [careLogs, setCareLogs] = useState([]);

  // care logs per plantId, loaded alongside the catalog so the "needs
  // attention" grouping and the Today row have real history to work from
  const [careLogsByPlant, setCareLogsByPlant] = useState({});
  // snapshot of "now" for the attention calculation below — captured
  // alongside the fetches rather than read via Date.now() during render,
  // since render must stay pure
  const [now, setNow] = useState(() => Date.now());

  // full-size photo currently open in the lightbox (null = closed)
  const [lightboxPlant, setLightboxPlant] = useState(null);

  // which cards have their details drawer (lore, care, actions) open —
  // cards stay photo-first by default and only grow on request
  const [expandedIds, setExpandedIds] = useState(() => new Set());
  const toggleExpanded = (plantId) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(plantId)) next.delete(plantId);
      else next.add(plantId);
      return next;
    });
  };

  // Escape closes whichever overlay is on top — one listener for all of
  // them, attached only while something is actually open
  const anyOverlayOpen = Boolean(
    lightboxPlant || loggingId || addOpen || menuOpen,
  );
  useEffect(() => {
    if (!anyOverlayOpen) return;
    const onKeyDown = (e) => {
      if (e.key !== "Escape") return;
      setLightboxPlant(null);
      setLoggingId(null);
      setAddOpen(false);
      setMenuOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [anyOverlayOpen]);

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
  // attention" grouping and the Today row
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
    return res.data;
  }, []);

  const fetchPlants = useCallback(async () => {
    const userId = auth.user?.profile.sub;
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
    // a plant with no name would render as a blank card — don't create one
    if (!form.name.trim()) return;

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
    setAddOpen(false);
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
    const logs = await refreshCareLogsForPlant(plantId);
    setCareLogs(sortByDateLogged(logs));
  };

  // open the quick picker for one plant, starting from a clean form
  const openCarePicker = (plantId) => {
    setCareForm({ careType: "", notes: "" });
    setLoggingId(plantId);
  };

  // submit the quick picker — same POST the old inline form used
  const handleLogCare = async (plantId) => {
    // the Log button is disabled until a type is picked, but guard anyway
    if (!careForm.careType) return;
    await axios.post(`${API}/carelogs`, {
      plantId,
      careType: careForm.careType,
      notes: careForm.notes,
    });
    setLoggingId(null);
    setCareForm({ careType: "", notes: "" });
    const logs = await refreshCareLogsForPlant(plantId);
    // if this plant's timeline is open, show the new entry right away
    if (viewingLogsId === plantId) setCareLogs(sortByDateLogged(logs));
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

  // most recent dateLogged for a plant, or null if it has no care history.
  // Pass a careType to only consider logs of that type (used for Drama).
  const lastLoggedDate = (plantId, careType) => {
    const logs = careLogsByPlant[plantId];
    if (!logs || logs.length === 0) return null;
    return logs.reduce((latest, log) => {
      if (careType && log.careType !== careType) return latest;
      const logged = new Date(log.dateLogged);
      return !latest || logged > latest ? logged : latest;
    }, null);
  };

  // days since any care, or null if never logged
  const daysSinceCare = (plantId) => {
    const last = lastLoggedDate(plantId);
    return last ? (now - last.getTime()) / MS_PER_DAY : null;
  };

  // true if a plant has never been logged, or not within the threshold
  const needsAttention = (plantId) => {
    const days = daysSinceCare(plantId);
    return days === null || days >= ATTENTION_THRESHOLD_DAYS;
  };

  // days since the most recent Drama log, but only while it's still inside
  // the window — null means "no active drama"
  const activeDramaDays = (plantId) => {
    const last = lastLoggedDate(plantId, "Drama");
    if (!last) return null;
    const days = (now - last.getTime()) / MS_PER_DAY;
    return days < DRAMA_WINDOW_DAYS ? days : null;
  };

  // short status line used on cards and the Today row
  const statusFor = (plantId) => {
    const drama = activeDramaDays(plantId);
    if (drama !== null) {
      // day 1 = the day the drama was logged; `short` drops the word
      // "Drama" for places that already show it as a label
      const day = Math.floor(drama) + 1;
      return { tone: "drama", label: `Drama · day ${day}`, short: `Day ${day}` };
    }
    const days = daysSinceCare(plantId);
    if (days === null) return { tone: "attention", label: "No care logged" };
    if (days >= ATTENTION_THRESHOLD_DAYS) {
      return { tone: "attention", label: `Last care ${formatDaysAgo(days)}` };
    }
    // compact form ("Cared 2d ago") so it fits under the name on the
    // narrow two-column cards without being cut off
    const whole = Math.floor(days);
    return {
      tone: "ok",
      label: whole <= 0 ? "Cared today" : `Cared ${whole}d ago`,
    };
  };

  // Today row — drama first (it's the most time-sensitive), then plants
  // that need attention. Built from the full catalog, not the search
  // results, so typing in search never hides a plant that needs care.
  const dramaPlants = plants.filter((p) => activeDramaDays(p.plantId) !== null);
  const todayPlants = [
    ...dramaPlants,
    ...plants.filter(
      (p) => activeDramaDays(p.plantId) === null && needsAttention(p.plantId),
    ),
  ];
  const attentionCount = plants.filter((p) => needsAttention(p.plantId)).length;

  // catalog search — matches name, species, or cultivar, case-insensitive
  const term = search.trim().toLowerCase();
  const searchedPlants = term
    ? plants.filter((plant) =>
        [plant.name, plant.species, plant.cultivar].some((field) =>
          field?.toLowerCase().includes(term),
        ),
      )
    : plants;

  // then the filter chip narrows it further
  const filteredPlants = searchedPlants.filter((p) => {
    if (filter === "attention") return needsAttention(p.plantId);
    if (filter === "drama") return activeDramaDays(p.plantId) !== null;
    return true;
  });

  const attentionPlants = filteredPlants.filter((p) =>
    needsAttention(p.plantId),
  );
  const restPlants = filteredPlants.filter(
    (p) => !needsAttention(p.plantId),
  );

  // the plant the quick picker is open for, looked up fresh each render
  const loggingPlant = plants.find((p) => p.plantId === loggingId);

  // header date line, e.g. "MONDAY · OCT 19" — derived from the `now`
  // snapshot for the same render-purity reason as above
  const nowDate = new Date(now);
  const dateLine = `${nowDate
    .toLocaleDateString(undefined, { weekday: "long" })
    .toUpperCase()} · ${nowDate
    .toLocaleDateString(undefined, { month: "short", day: "numeric" })
    .toUpperCase()}`;

  // avatar shows the first letter of the signed-in email
  const initial = (auth.user?.profile.email || "?").charAt(0).toUpperCase();

  // renders one plant card — shared by the "needs attention" and
  // "all plants" groups so the two lists don't duplicate the JSX
  const renderPlantCard = (plant) => {
    const status = statusFor(plant.plantId);
    const isEditing = editingId === plant.plantId;
    const isExpanded = expandedIds.has(plant.plantId);
    // in grid view, plants that need attention get the big featured card
    // so they're impossible to miss
    const featured = viewMode === "grid" && status.tone !== "ok";

    return (
      <article
        key={plant.plantId}
        className={[
          "plant-card",
          viewMode === "list" ? "card-list" : "",
          featured ? "card-featured" : "",
          `card-${status.tone}`,
          isEditing || isExpanded ? "card-open" : "",
        ].join(" ")}
      >
        {/* photo — falls back to a leaf placeholder when none is set;
            tap to open full-size */}
        <div className="card-media">
          {plant.imageUrl ? (
            <button
              type="button"
              className="card-media-open"
              onClick={() => setLightboxPlant(plant)}
              aria-label={`View full-size photo of ${plant.name || "plant"}`}
            >
              <img src={plant.imageUrl} alt="" />
            </button>
          ) : (
            <div className="card-media-placeholder">
              <IconLeaf />
            </div>
          )}

          {/* status pill only when there's something to act on — a calm
              plant's status lives in the caption instead */}
          {status.tone !== "ok" && (
            <span className={`status-pill pill-${status.tone}`}>
              {status.label}
            </span>
          )}

          {/* details toggle lives in the photo's top corner (not the name
              bar) so narrow two-column cards still have room for the name */}
          <button
            type="button"
            className="round-btn card-more"
            aria-label={`More about ${plant.name}`}
            aria-expanded={isExpanded}
            onClick={() => toggleExpanded(plant.plantId)}
          >
            <IconMore />
          </button>

          {/* name bar sits over the photo so the plant stays the hero */}
          <div className="card-caption">
            <div className="card-caption-text">
              <h3 className="card-name">{plant.name}</h3>
              <p className="card-species">
                {status.tone === "ok" ? status.label : plant.species}
              </p>
            </div>
            <button
              type="button"
              className="round-btn round-btn-lime"
              aria-label={`Log care for ${plant.name}`}
              onClick={() => openCarePicker(plant.plantId)}
            >
              <IconPlus />
            </button>
          </div>
        </div>

        {/* ── Edit mode ── */}
        {isEditing && (
          <div className="card-body edit-form">
            {[
              ["name", "Plant name"],
              ["species", "Species"],
              ["cultivar", "Cultivar"],
              ["lore", "Lore"],
              ["careInstructions", "Care instructions"],
              ["watchFor", "Watch for"],
            ].map(([key, label]) => (
              <div className="field-group" key={key}>
                <label
                  className="field-label"
                  htmlFor={`edit-${key}-${plant.plantId}`}
                >
                  {label}
                </label>
                <input
                  className="field"
                  id={`edit-${key}-${plant.plantId}`}
                  value={editForm[key] || ""}
                  onChange={(e) =>
                    setEditForm({ ...editForm, [key]: e.target.value })
                  }
                />
              </div>
            ))}
            <div className="field-group">
              <span className="field-label">Photo</span>
              <div className="photo-picker">
                {/* the real file input is visually hidden; this label is
                    the styled, tappable stand-in for it */}
                <label
                  className="btn-ghost"
                  htmlFor={`edit-photo-${plant.plantId}`}
                >
                  Choose photo
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
                      ? "Current photo kept"
                      : "No photo yet"}
                </span>
              </div>
              {editImagePreview && (
                <img
                  className="photo-preview"
                  src={editImagePreview}
                  alt="Selected photo preview"
                />
              )}
            </div>
            <div className="button-row">
              <button
                className="btn-primary"
                onClick={() => handleEditSave(plant.plantId)}
              >
                Save
              </button>
              <button className="btn-ghost" onClick={() => setEditingId(null)}>
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* ── Details drawer — lore, care, and the less frequent actions ── */}
        {!isEditing && isExpanded && (
          <div className="card-body">
            {plant.cultivar && (
              <p className="card-cultivar">{plant.cultivar}</p>
            )}
            {plant.lore && (
              <div className="meta-row">
                <span className="meta-label">Lore</span>
                <p className="meta-value lore-value">{plant.lore}</p>
              </div>
            )}
            {plant.careInstructions && (
              <div className="meta-row">
                <span className="meta-label">Care</span>
                <p className="meta-value">{plant.careInstructions}</p>
              </div>
            )}
            {plant.watchFor && (
              <div className="meta-row">
                <span className="meta-label">Watch for</span>
                <p className="meta-value">{plant.watchFor}</p>
              </div>
            )}

            <div className="button-row">
              <button className="btn-ghost" onClick={() => handleEditOpen(plant)}>
                <IconEdit /> Edit
              </button>
              <button
                className="btn-ghost"
                aria-pressed={viewingLogsId === plant.plantId}
                onClick={() => handleViewLogs(plant.plantId)}
              >
                <IconLog />
                {viewingLogsId === plant.plantId ? "Hide log" : "Care log"}
              </button>
              <button
                className="btn-ghost btn-danger"
                onClick={() => {
                  if (
                    window.confirm(
                      `Delete ${plant.name || "this plant"}? This cannot be undone.`,
                    )
                  ) {
                    handleDeletePlant(plant.plantId);
                  }
                }}
              >
                <IconTrash /> Delete
              </button>
            </div>

            {/* ── Care log timeline ── */}
            {viewingLogsId === plant.plantId && (
              <div className="care-timeline">
                {careLogs.length === 0 ? (
                  <p className="timeline-empty">No entries yet</p>
                ) : (
                  <ul className="timeline-list">
                    {careLogs.map((log) => (
                      <li key={log.logId} className="timeline-entry">
                        <span
                          className={`timeline-dot ${log.careType === "Drama" ? "dot-drama" : "dot-lime"}`}
                          aria-hidden="true"
                        />
                        <div className="timeline-content">
                          <span className="timeline-type">{log.careType}</span>
                          <span className="timeline-date">
                            {new Date(log.dateLogged).toLocaleDateString()}
                          </span>
                          {log.notes && (
                            <p className="timeline-notes">{log.notes}</p>
                          )}
                        </div>
                        <button
                          className="timeline-delete"
                          aria-label={`Delete ${log.careType} entry`}
                          onClick={() =>
                            handleDeleteCareLog(log.logId, plant.plantId)
                          }
                        >
                          <IconClose />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        )}
      </article>
    );
  };

  // show loading state while Cognito initializes
  if (auth.isLoading) {
    return <div className="auth-status">Loading…</div>;
  }

  // show error if auth fails
  if (auth.error) {
    return <div className="auth-status">Sign-in error: {auth.error.message}</div>;
  }

  // if not authenticated, show sign in screen
  if (!auth.isAuthenticated) {
    return (
      <main className="auth-screen">
        <div className="auth-card">
          <span className="app-wordmark">Rooted Upright</span>
          <p className="auth-prompt">Every plant has a story.</p>
          <button className="btn-primary" onClick={() => auth.signinRedirect()}>
            Sign in
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="app-shell">
      {/* ── Header ── */}
      <header className="app-header">
        <div className="app-header-text">
          <span className="app-date">{dateLine}</span>
          <h1 className="app-wordmark">Rooted Upright</h1>
        </div>
        <div className="account">
          <button
            className="avatar-btn"
            aria-label="Account"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
          >
            {initial}
          </button>
          {menuOpen && (
            <div className="account-menu">
              <button className="account-menu-item" onClick={signOutRedirect}>
                Sign out
              </button>
            </div>
          )}
        </div>
      </header>

      {/* ── Today row ── */}
      <section className="today" aria-labelledby="today-heading">
        <div className="section-head">
          <h2 id="today-heading" className="section-title">
            Today
          </h2>
          <span className="section-count">
            {todayPlants.length === 0
              ? "ALL CAUGHT UP"
              : `${todayPlants.length} ${todayPlants.length === 1 ? "TASK" : "TASKS"}`}
          </span>
        </div>
        {todayPlants.length > 0 && (
          <ul className="today-row">
            {todayPlants.map((plant) => {
              const status = statusFor(plant.plantId);
              return (
                <li key={plant.plantId} className={`today-card today-${status.tone}`}>
                  <span className="today-label">
                    {status.tone === "drama" ? "DRAMA" : "CHECK IN"}
                  </span>
                  <span className="today-name">{plant.name}</span>
                  {/* the DRAMA label already says what it is, so drama
                      cards only need the day count here */}
                  <span className="today-detail">
                    {status.short || status.label}
                  </span>
                  <button
                    className="today-done"
                    onClick={() => openCarePicker(plant.plantId)}
                  >
                    Done
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* ── Catalog ── */}
      <section className="catalog" aria-labelledby="catalog-heading">
        <h2 id="catalog-heading" className="visually-hidden">
          Your collection
        </h2>

        <div className="chip-row" role="group" aria-label="Filter plants">
          <button
            className={`chip ${filter === "all" ? "chip-active" : ""}`}
            aria-pressed={filter === "all"}
            onClick={() => setFilter("all")}
          >
            All {plants.length}
          </button>
          <button
            className={`chip ${filter === "attention" ? "chip-active" : ""}`}
            aria-pressed={filter === "attention"}
            onClick={() => setFilter("attention")}
          >
            Needs care {attentionCount}
          </button>
          <button
            className={`chip chip-drama ${filter === "drama" ? "chip-active" : ""}`}
            aria-pressed={filter === "drama"}
            onClick={() => setFilter("drama")}
          >
            Drama {dramaPlants.length}
          </button>
        </div>

        <div className="toolbar">
          <label className="search">
            <IconSearch />
            <span className="visually-hidden">Search plants</span>
            <input
              ref={searchRef}
              className="search-input"
              type="search"
              placeholder="Search name, species, cultivar"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
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

        <div className={`plant-grid ${viewMode === "list" ? "plant-grid-list" : ""}`}>
          {filteredPlants.length === 0 && (
            <p className="catalog-empty">
              {plants.length === 0
                ? "No plants yet. Tap + to add your first one."
                : "No plants match."}
            </p>
          )}

          {attentionPlants.length > 0 && (
            <p className="group-header group-header-attention">
              Needs attention ({attentionPlants.length})
            </p>
          )}
          {attentionPlants.map(renderPlantCard)}

          {attentionPlants.length > 0 && restPlants.length > 0 && (
            <p className="group-header">All plants</p>
          )}
          {restPlants.map(renderPlantCard)}
        </div>
      </section>

      {/* ── Bottom bar ── */}
      <nav className="bottom-bar" aria-label="Main">
        <button
          className="bar-btn bar-btn-active"
          aria-label="Back to top"
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        >
          <IconGrid />
        </button>
        <button
          className="bar-fab"
          aria-label="Add plant"
          onClick={() => setAddOpen(true)}
        >
          <IconPlus />
        </button>
        <button
          className="bar-btn"
          aria-label="Search plants"
          onClick={() => {
            // preventScroll keeps the focus from jumping the page before
            // the smooth scroll gets there
            searchRef.current?.focus({ preventScroll: true });
            searchRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
          }}
        >
          <IconSearch />
        </button>
      </nav>

      {/* ── Quick care picker ── */}
      {loggingPlant && (
        <Sheet
          title={`Log care for ${loggingPlant.name}`}
          onClose={() => setLoggingId(null)}
        >
          <div className="sheet-head">
            <div className="sheet-thumb">
              {loggingPlant.imageUrl ? (
                <img src={loggingPlant.imageUrl} alt="" />
              ) : (
                <IconLeaf />
              )}
            </div>
            <div className="sheet-head-text">
              <h2 className="sheet-title">{loggingPlant.name}</h2>
              <p className="sheet-sub">{statusFor(loggingPlant.plantId).label}</p>
            </div>
            <button
              className="round-btn"
              aria-label="Close"
              onClick={() => setLoggingId(null)}
            >
              <IconClose />
            </button>
          </div>

          <span className="field-label" id="care-type-label">
            What did you do?
          </span>
          <div
            className="care-type-grid"
            role="radiogroup"
            aria-labelledby="care-type-label"
          >
            {CARE_TYPES.map((type) => (
              <button
                key={type}
                role="radio"
                aria-checked={careForm.careType === type}
                className={[
                  "care-type",
                  type === "Drama" ? "care-type-drama" : "",
                  careForm.careType === type ? "care-type-selected" : "",
                ].join(" ")}
                onClick={() => setCareForm({ ...careForm, careType: type })}
              >
                {type}
              </button>
            ))}
          </div>

          <label className="field-label" htmlFor="care-note">
            Note (optional)
          </label>
          <input
            id="care-note"
            className="field"
            placeholder="New leaf unfurling…"
            value={careForm.notes}
            onChange={(e) => setCareForm({ ...careForm, notes: e.target.value })}
          />

          <button
            className="btn-primary btn-block"
            disabled={!careForm.careType}
            onClick={() => handleLogCare(loggingPlant.plantId)}
          >
            {careForm.careType ? `Log ${careForm.careType}` : "Pick what you did"}
          </button>
        </Sheet>
      )}

      {/* ── Add plant ── */}
      {addOpen && (
        <Sheet title="Add a plant" onClose={() => setAddOpen(false)}>
          <div className="sheet-head">
            <div className="sheet-head-text">
              <h2 className="sheet-title">Add a plant</h2>
              <p className="sheet-sub">Only the name is required.</p>
            </div>
            <button
              className="round-btn"
              aria-label="Close"
              onClick={() => setAddOpen(false)}
            >
              <IconClose />
            </button>
          </div>

          <div className="sheet-scroll">
            {[
              ["name", "Plant name", "Andromeda"],
              ["species", "Species", "Monstera deliciosa"],
              ["cultivar", "Cultivar", "Thai Constellation"],
              ["lore", "Lore", "Where did this one come from?"],
              ["careInstructions", "Care instructions", "Bright indirect light…"],
              ["watchFor", "Watch for", "Warning signs…"],
            ].map(([key, label, placeholder]) => (
              <div className="field-group" key={key}>
                <label className="field-label" htmlFor={`add-${key}`}>
                  {label}
                </label>
                <input
                  className="field"
                  id={`add-${key}`}
                  name={key}
                  placeholder={placeholder}
                  value={form[key]}
                  onChange={handleChange}
                />
              </div>
            ))}

            <div className="field-group">
              <span className="field-label">Photo</span>
              <div className="photo-picker">
                <label className="btn-ghost" htmlFor="add-photo">
                  Choose photo
                </label>
                <input
                  className="photo-picker-input"
                  type="file"
                  id="add-photo"
                  accept="image/*"
                  onChange={handleImagePick}
                />
                <span className="photo-picker-name">
                  {imageFile ? imageFile.name : "No photo yet"}
                </span>
              </div>
              {imagePreview && (
                <img
                  className="photo-preview"
                  src={imagePreview}
                  alt="Selected photo preview"
                />
              )}
            </div>
          </div>

          <button
            className="btn-primary btn-block"
            disabled={!form.name.trim()}
            onClick={handleAddPlant}
          >
            Add plant
          </button>
        </Sheet>
      )}

      {/* ── Photo lightbox ── */}
      {lightboxPlant && (
        <div
          className="lightbox-overlay"
          role="dialog"
          aria-modal="true"
          aria-label={`${lightboxPlant.name || "Plant"} photo`}
          onClick={() => setLightboxPlant(null)}
        >
          <button
            type="button"
            className="lightbox-close round-btn"
            onClick={() => setLightboxPlant(null)}
            aria-label="Close"
          >
            <IconClose />
          </button>
          <img
            className="lightbox-image"
            src={lightboxPlant.imageUrl}
            alt={lightboxPlant.name || "plant photo"}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </main>
  );
}

export default App;
