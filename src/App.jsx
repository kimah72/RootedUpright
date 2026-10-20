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

// one chevron, pointed by a prop, rather than two near-identical icons
const IconChevron = ({ direction }) => (
  <svg {...iconProps}>
    <path d={direction === "left" ? "M15 18l-6-6 6-6" : "M9 18l6-6-6-6"} />
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

// Load one plant's care logs, retrying once on failure. The catalog loads
// every plant's history at the same moment, so an occasional request can
// fail — a single retry rides out those blips. Throws if both tries fail.
const getCareLogs = async (plantId) => {
  const url = `${API}/carelogs?plantId=${plantId}`;
  try {
    return (await axios.get(url)).data;
  } catch {
    await new Promise((resolve) => setTimeout(resolve, 600));
    return (await axios.get(url)).data;
  }
};

// The backend reads care logs through a DynamoDB index, and an index
// updates a moment AFTER a write. So a read right after logging can be
// missing the new entry, and a read right after deleting can still include
// the old one. These remember what we just did so the screen doesn't
// flicker backwards while the index catches up. They live outside the
// component (not in state) because changing them never needs a re-render,
// and the app only ever has one copy of App on the page.
const localLogs = {}; // plantId → logs saved but not yet seen from the server
const deletedIds = new Set(); // logIds deleted this session

// how close a server log's time must be to a just-saved local one to count
// as "the same entry" (covers a small difference between clocks)
const SAME_LOG_WINDOW_MS = 2 * 60 * 1000;

const rememberLocalLogs = (plantId, logs) => {
  localLogs[plantId] = [...(localLogs[plantId] || []), ...logs];
};

const rememberDeleted = (logId) => {
  deletedIds.add(logId);
};

// combine a fresh server list with what we know we just changed
const reconcileLogs = (plantId, fresh) => {
  const logs = fresh.filter((log) => !deletedIds.has(log.logId));
  // a local entry is confirmed once the server returns the same care type
  // logged at about the same time; until then, keep showing it
  const stillPending = (localLogs[plantId] || []).filter(
    (local) =>
      !logs.some(
        (log) =>
          log.careType === local.careType &&
          Math.abs(new Date(log.dateLogged) - new Date(local.dateLogged)) <
            SAME_LOG_WINDOW_MS,
      ),
  );
  localLogs[plantId] = stillPending;
  return [...logs, ...stillPending];
};

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

  // Today carousel — which card is centered (it gets drawn larger)
  const [focusIndex, setFocusIndex] = useState(0);
  const todayRowRef = useRef(null);
  // On scroll, find the card whose center is closest to the row's center.
  // Measuring real positions (instead of dividing scrollLeft by a card
  // width) keeps this correct even though the cards change size.
  const handleTodayScroll = () => {
    const row = todayRowRef.current;
    if (!row) return;
    const rowCenter = row.scrollLeft + row.clientWidth / 2;
    let closest = 0;
    let closestDistance = Infinity;
    [...row.children].forEach((card, index) => {
      const cardCenter = card.offsetLeft + card.offsetWidth / 2;
      const distance = Math.abs(cardCenter - rowCenter);
      if (distance < closestDistance) {
        closestDistance = distance;
        closest = index;
      }
    });
    setFocusIndex(closest);
  };

  // Slide the carousel so card `index` is centered. Used by the arrows,
  // the dots, and clicking a faded card — a mouse has no swipe gesture, so
  // without these the other cards were unreachable on a laptop. The scroll
  // fires onScroll, which updates focusIndex, so nothing else to set here.
  const scrollToToday = (index) => {
    const card = todayRowRef.current?.children[index];
    card?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  };

  // which plant the quick care picker is open for (null = closed)
  const [loggingId, setLoggingId] = useState(null);
  // careTypes is a list — you can log several kinds of care at once
  // (e.g. watered AND repotted), each saved as its own care log entry
  const [careForm, setCareForm] = useState({
    careTypes: [],
    notes: "",
  });

  // care types logged this session, by plantId — keeps a plant on the
  // Today row after you log it (marked done) so you can add more care
  // to it later instead of it vanishing the moment it's cared for
  const [loggedToday, setLoggedToday] = useState({});

  // add-plant form now lives in a sheet behind the + button instead of
  // sitting at the top of the page on every visit
  const [addOpen, setAddOpen] = useState(false);

  // account menu (sign out) under the avatar button
  const [menuOpen, setMenuOpen] = useState(false);

  // care logs per plantId, loaded alongside the catalog so the "needs
  // attention" grouping and the Today row have real history to work from
  const [careLogsByPlant, setCareLogsByPlant] = useState({});
  // true once care logs have loaded at least once — until then, nothing is
  // flagged as needing attention, since careLogsByPlant starts empty and
  // would otherwise make every plant look overdue during the initial load
  const [careLogsLoaded, setCareLogsLoaded] = useState(false);
  // snapshot of "now" for the attention calculation below — captured
  // alongside the fetches rather than read via Date.now() during render,
  // since render must stay pure
  const [now, setNow] = useState(() => Date.now());

  // full-size photo currently open in the lightbox (null = closed)
  const [lightboxPlant, setLightboxPlant] = useState(null);

  // which plant's page is open in the overlay (null = none). The page is
  // an overlay rather than the card growing in place, so nothing in the
  // catalog behind it moves while you edit or delete logs.
  const [openId, setOpenId] = useState(null);
  // care log on the plant page is hidden until asked for, so the page
  // opens short and calm
  const [logsOpen, setLogsOpen] = useState(false);
  const openPlant = (plantId) => {
    setOpenId(plantId);
    setEditingId(null); // always open on the info view, not the edit form
    setLogsOpen(false); // each plant opens with its log tucked away
  };
  const closePlant = () => {
    setOpenId(null);
    setEditingId(null);
  };

  // care log delete with Undo — the entry disappears right away, but the
  // real DELETE waits a few seconds so a mis-tap can be taken back
  const UNDO_MS = 5000;
  // { log, plantId, timer } — the timer id rides along with the pending
  // delete, so Undo can cancel exactly the one it belongs to
  const [pendingDelete, setPendingDelete] = useState(null);

  // Escape closes whichever overlay is on top — one listener for all of
  // them, attached only while something is actually open
  const anyOverlayOpen = Boolean(
    lightboxPlant || loggingId || addOpen || menuOpen || openId,
  );
  useEffect(() => {
    if (!anyOverlayOpen) return;
    const onKeyDown = (e) => {
      if (e.key !== "Escape") return;
      // close only the topmost layer — Esc in the care picker shouldn't
      // also close the plant page underneath it
      if (lightboxPlant) setLightboxPlant(null);
      else if (loggingId) setLoggingId(null);
      else if (addOpen) setAddOpen(false);
      else if (openId) {
        setOpenId(null);
        setEditingId(null);
      } else setMenuOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [anyOverlayOpen, lightboxPlant, loggingId, addOpen, openId]);

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
  const fetchCareLogsForPlants = useCallback(
    async (plantList) => {
      const entries = await Promise.all(
        plantList.map(async (plant) => {
          try {
            const fresh = await getCareLogs(plant.plantId);
            return [plant.plantId, reconcileLogs(plant.plantId, fresh)];
          } catch {
            // null = "couldn't load", which is NOT the same as "no logs" —
            // treating a failed load as empty is what made plants show
            // "No care logged" by mistake
            return [plant.plantId, null];
          }
        }),
      );
      setCareLogsByPlant((prev) => {
        const next = {};
        entries.forEach(([plantId, logs]) => {
          // on failure, keep whatever we already had for that plant
          if (logs) next[plantId] = logs;
          else if (prev[plantId]) next[plantId] = prev[plantId];
        });
        return next;
      });
      setCareLogsLoaded(true);
      setNow(Date.now());
    },
    [],
  );

  // refetches just one plant's care history — used after logging/deleting a
  // care log so its attention status updates without re-fetching everyone
  const refreshCareLogsForPlant = useCallback(
    async (plantId) => {
      try {
        const logs = reconcileLogs(plantId, await getCareLogs(plantId));
        setCareLogsByPlant((prev) => ({ ...prev, [plantId]: logs }));
      } catch {
        // keep showing what we have; the next refresh will catch up
      }
      setNow(Date.now());
    },
    [],
  );

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
    closePlant();
    fetchPlants();
  };

  // most recent first — logId is a random id, not chronological, so
  // dateLogged is the only reliable sort key
  const sortByDateLogged = (logs) =>
    [...logs].sort(
      (a, b) => new Date(b.dateLogged) - new Date(a.dateLogged),
    );

  // actually remove a care log on the server, then refresh that plant
  const commitDeleteCareLog = async ({ log, plantId }) => {
    // remember the delete and drop it from the screen right away, so a
    // lagging read can't make it pop back
    rememberDeleted(log.logId);
    setCareLogsByPlant((prev) => ({
      ...prev,
      [plantId]: (prev[plantId] || []).filter((l) => l.logId !== log.logId),
    }));
    await axios.delete(`${API}/carelogs`, {
      data: { logId: log.logId, plantId },
    });
    refreshCareLogsForPlant(plantId);
  };

  // tap × → hide the entry now, delete it for real after UNDO_MS
  const handleDeleteCareLog = (log, plantId) => {
    // a second delete before the first one's timer ends: finish the first
    // one now, so only one Undo is ever pending
    if (pendingDelete) {
      clearTimeout(pendingDelete.timer);
      commitDeleteCareLog(pendingDelete);
    }
    const timer = setTimeout(() => {
      commitDeleteCareLog({ log, plantId });
      setPendingDelete(null);
    }, UNDO_MS);
    setPendingDelete({ log, plantId, timer });
  };

  const undoDeleteCareLog = () => {
    clearTimeout(pendingDelete?.timer);
    setPendingDelete(null);
  };

  // open the quick picker for one plant, starting from a clean form
  const openCarePicker = (plantId) => {
    setCareForm({ careTypes: [], notes: "" });
    setLoggingId(plantId);
  };

  // submit the quick picker — same POST the old inline form used
  const handleLogCare = async (plantId) => {
    const { careTypes, notes } = careForm;
    // the Log button is disabled until a type is picked, but guard anyway
    if (careTypes.length === 0) return;
    // one entry per care type, all sent together; the note goes on each so
    // every entry still makes sense when read on its own in the timeline
    await Promise.all(
      careTypes.map((careType) =>
        axios.post(`${API}/carelogs`, { plantId, careType, notes }),
      ),
    );
    // show the new entries immediately, and keep them until the server's
    // index includes them (see reconcileLogs)
    const loggedAt = new Date().toISOString();
    const newLogs = careTypes.map((careType) => ({
      logId: `local-${plantId}-${careType}-${loggedAt}`,
      plantId,
      careType,
      notes,
      dateLogged: loggedAt,
    }));
    rememberLocalLogs(plantId, newLogs);
    setCareLogsByPlant((prev) => ({
      ...prev,
      [plantId]: [...(prev[plantId] || []), ...newLogs],
    }));
    // only plants already on the Today row get remembered there — logging
    // a plant from the catalog shouldn't add it to Today
    if (todayPlants.some((p) => p.plantId === plantId)) {
      setLoggedToday((prev) => ({
        ...prev,
        [plantId]: [...(prev[plantId] || []), ...careTypes],
      }));
    }
    setLoggingId(null);
    setCareForm({ careTypes: [], notes: "" });
    // the plant page reads straight from careLogsByPlant, so this refresh
    // is all it takes for a new entry to show up there
    refreshCareLogsForPlant(plantId);
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

  // true if a plant has never been logged, or not within the threshold.
  // Before care logs have loaded at least once, nothing is flagged --
  // otherwise every plant reads as overdue during the initial load.
  // false while a plant's history couldn't be loaded — unknown isn't "none"
  const hasLogData = (plantId) => Boolean(careLogsByPlant[plantId]);

  const needsAttention = (plantId) => {
    if (!careLogsLoaded || !hasLogData(plantId)) return false;
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
    // say so honestly instead of claiming "No care logged"
    if (careLogsLoaded && !hasLogData(plantId)) {
      return { tone: "ok", label: "Couldn't load care", pill: "?" };
    }
    const drama = activeDramaDays(plantId);
    if (drama !== null) {
      // day 1 = the day the drama was logged; `short` drops the word
      // "Drama" for places that already show it as a label
      const day = Math.floor(drama) + 1;
      return {
        tone: "drama",
        label: `Drama · day ${day}`,
        short: `Day ${day}`,
        pill: "Drama", // pills sit on ~108px phone tiles, so keep them tiny
      };
    }
    const days = daysSinceCare(plantId);
    if (days === null) {
      return { tone: "attention", label: "No care logged", pill: "New" };
    }
    if (days >= ATTENTION_THRESHOLD_DAYS) {
      return {
        tone: "attention",
        label: `Last care ${formatDaysAgo(days)}`,
        pill: `${Math.floor(days)}d`,
      };
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
  const openTasks = [
    ...dramaPlants,
    ...plants.filter(
      (p) => activeDramaDays(p.plantId) === null && needsAttention(p.plantId),
    ),
  ];
  // plants logged from Today this session stay on the row, after the open
  // tasks, so more care can be added to them
  const donePlants = plants.filter(
    (p) => loggedToday[p.plantId] && !openTasks.includes(p),
  );
  const todayPlants = [...openTasks, ...donePlants];
  const checkInCount = openTasks.length - dramaPlants.length;
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

  // the plants the quick picker / plant page are open for, looked up
  // fresh each render so edits show up immediately
  const loggingPlant = plants.find((p) => p.plantId === loggingId);
  const openPlantData = plants.find((p) => p.plantId === openId);

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

    return (
      <article
        key={plant.plantId}
        className={[
          "plant-card",
          viewMode === "list" ? "card-list" : "",
          `card-${status.tone}`,
        ].join(" ")}
      >
        <div className="card-media">
          {/* photo — falls back to a leaf placeholder when none is set.
              Grid photos are portrait (taller than wide) because plants
              grow up, not sideways. */}
          {plant.imageUrl ? (
            <img src={plant.imageUrl} alt="" />
          ) : (
            <div className="card-media-placeholder">
              <IconLeaf />
            </div>
          )}

          {/* One invisible button covers the whole card, so tapping
              anywhere opens the plant page. It's a real button rather than
              an onClick on the div so keyboards and screen readers can use
              it too. The + button below sits above it. */}
          <button
            type="button"
            className="card-tap"
            aria-label={`Open ${plant.name || "plant"}`}
            onClick={() => openPlant(plant.plantId)}
          />

          {/* status pill only when there's something to act on — a calm
              plant's status lives in the caption instead */}
          {status.tone !== "ok" && (
            <span
              className={`status-pill pill-${status.tone}`}
              // the full wording for screen readers and hover, since the
              // visible pill is abbreviated to fit small tiles
              title={status.label}
            >
              {status.pill}
            </span>
          )}

          {/* name sits below the photo now, so it never covers the plant */}
          <div className="card-caption">
            <div className="card-caption-text">
              <h3 className="card-name">{plant.name}</h3>
              {/* Grid: urgent plants show species here because their status
                  is already in the pill. List rows have no pill, so they
                  always show the status, tinted by tone. */}
              <p className={`card-species species-${status.tone}`}>
                {status.tone === "ok" || viewMode === "list"
                  ? status.label
                  : plant.species}
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
      </article>
    );
  };

  // ── Plant page — everything about one plant, in an overlay ──
  const renderPlantPage = (plant) => {
    const status = statusFor(plant.plantId);
    const isEditing = editingId === plant.plantId;
    // read logs straight from the shared cache (always current after a
    // log or delete), hiding one that's waiting out its Undo window
    const logs = sortByDateLogged(careLogsByPlant[plant.plantId] || []).filter(
      (log) => log.logId !== pendingDelete?.log.logId,
    );

    return (
      <Sheet title={plant.name || "Plant"} onClose={closePlant}>
        <div className="sheet-head">
          <div className="sheet-head-text">
            <h2 className="sheet-title">{plant.name}</h2>
            <p className="sheet-sub">
              {[plant.species, plant.cultivar].filter(Boolean).join(" · ")}
            </p>
          </div>
          <button className="round-btn" aria-label="Close" onClick={closePlant}>
            <IconClose />
          </button>
        </div>

        <div className="sheet-scroll">
          {/* ── Edit mode ── */}
          {isEditing ? (
            <div className="edit-form">
              {[
                ["name", "Plant name"],
                ["species", "Species"],
                ["cultivar", "Cultivar"],
                ["lore", "Lore"],
                ["careInstructions", "Care instructions"],
                ["watchFor", "Watch for"],
              ].map(([key, label]) => (
                <div className="field-group" key={key}>
                  <label className="field-label" htmlFor={`edit-${key}`}>
                    {label}
                  </label>
                  <input
                    className="field"
                    id={`edit-${key}`}
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
                  <label className="btn-ghost" htmlFor="edit-photo">
                    Choose photo
                  </label>
                  <input
                    className="photo-picker-input"
                    type="file"
                    id="edit-photo"
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
          ) : (
            <>
              {/* whole photo, never cropped (object-fit: contain) — tap for
                  full screen */}
              {plant.imageUrl && (
                <button
                  type="button"
                  className="page-photo"
                  aria-label={`View full-size photo of ${plant.name}`}
                  onClick={() => setLightboxPlant(plant)}
                >
                  <img src={plant.imageUrl} alt="" />
                </button>
              )}

              <div className="page-status-row">
                <span className={`page-status page-status-${status.tone}`}>
                  {status.label}
                </span>
                <button
                  className="btn-primary"
                  onClick={() => openCarePicker(plant.plantId)}
                >
                  Log care
                </button>
              </div>

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

              {/* ── Care log — hidden until "Show" is tapped ── */}
              <div className="care-timeline">
                <button
                  className="timeline-toggle"
                  aria-expanded={logsOpen}
                  onClick={() => setLogsOpen((open) => !open)}
                >
                  <span className="meta-label">Care log ({logs.length})</span>
                  <span className="timeline-toggle-text">
                    {logsOpen ? "Hide" : "Show"}
                  </span>
                </button>
                {!logsOpen ? null : logs.length === 0 ? (
                  <p className="timeline-empty">No entries yet</p>
                ) : (
                  <ul className="timeline-list">
                    {logs.map((log) => (
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
                        {/* a just-saved entry has no real id from the
                            server yet, so it can't be deleted until the
                            next refresh brings the real one in */}
                        {log.logId.startsWith("local-") ? (
                          <span className="timeline-saving">Saved</span>
                        ) : (
                          <button
                            className="timeline-delete"
                            aria-label={`Delete ${log.careType} entry`}
                            onClick={() => handleDeleteCareLog(log, plant.plantId)}
                          >
                            <IconClose />
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="button-row">
                <button className="btn-ghost" onClick={() => handleEditOpen(plant)}>
                  <IconEdit /> Edit
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
                  <IconTrash /> Delete plant
                </button>
              </div>
            </>
          )}
        </div>
      </Sheet>
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
          {/* a gentler summary than a raw task count — splitting drama
              from routine check-ins makes the list feel less like a pile */}
          <span className="section-count">
            {openTasks.length === 0 && donePlants.length === 0
              ? "ALL CAUGHT UP"
              : [
                  dramaPlants.length > 0 && `${dramaPlants.length} DRAMA`,
                  checkInCount > 0 &&
                    `${checkInCount} CHECK-IN${checkInCount === 1 ? "" : "S"}`,
                  donePlants.length > 0 && `${donePlants.length} DONE`,
                ]
                  .filter(Boolean)
                  .join(" · ")}
          </span>
        </div>
        {todayPlants.length > 0 && (
          <ul
            className="today-row"
            ref={todayRowRef}
            onScroll={handleTodayScroll}
          >
            {todayPlants.map((plant, index) => {
              const status = statusFor(plant.plantId);
              // done = logged from Today this session and no longer an
              // open task (a drama plant stays an open task until its
              // drama window passes)
              const done = donePlants.includes(plant);
              // clamp so the last card still focuses if the list shrinks
              // (e.g. right after logging care removes a card)
              const focused =
                index === Math.min(focusIndex, todayPlants.length - 1);
              return (
                <li
                  key={plant.plantId}
                  className={[
                    "today-card",
                    done ? "today-complete" : `today-${status.tone}`,
                    focused ? "today-focused" : "",
                  ].join(" ")}
                  // clicking a faded side card brings it to the center
                  // (the arrows below are the keyboard-friendly way)
                  onClick={focused ? undefined : () => scrollToToday(index)}
                >
                  <div className="today-thumb">
                    {plant.imageUrl ? (
                      <img src={plant.imageUrl} alt="" />
                    ) : (
                      <IconLeaf />
                    )}
                  </div>
                  <span className="today-label">
                    {done
                      ? "✓ LOGGED"
                      : status.tone === "drama"
                        ? `DRAMA · ${status.short.toUpperCase()}`
                        : "CHECK IN"}
                  </span>
                  <span className="today-name">{plant.name}</span>
                  {done ? (
                    <span className="today-detail">
                      {/* Set removes repeats if the same type was logged twice */}
                      {[...new Set(loggedToday[plant.plantId])].join(", ")}
                    </span>
                  ) : (
                    status.tone !== "drama" && (
                      <span className="today-detail">{status.label}</span>
                    )
                  )}
                  <button
                    className="today-done"
                    onClick={(e) => {
                      // don't let this click also trigger the card's
                      // "bring to center" handler
                      e.stopPropagation();
                      openCarePicker(plant.plantId);
                    }}
                  >
                    {/* "Log care", not "Done" — it only opens the picker;
                        nothing is saved until a care type is chosen */}
                    {done ? "Add more" : "Log care"}
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {/* arrows + dots — only worth showing when there's more than one */}
        {todayPlants.length > 1 && (() => {
          const current = Math.min(focusIndex, todayPlants.length - 1);
          return (
            <div className="today-nav">
              <button
                className="round-btn"
                aria-label="Previous task"
                disabled={current === 0}
                onClick={() => scrollToToday(current - 1)}
              >
                <IconChevron direction="left" />
              </button>
              <div className="today-dots">
                {todayPlants.map((plant, index) => (
                  <button
                    key={plant.plantId}
                    className={`today-dot ${index === current ? "today-dot-active" : ""}`}
                    aria-label={`Go to ${plant.name}`}
                    aria-current={index === current}
                    onClick={() => scrollToToday(index)}
                  />
                ))}
              </div>
              <button
                className="round-btn"
                aria-label="Next task"
                disabled={current === todayPlants.length - 1}
                onClick={() => scrollToToday(current + 1)}
              >
                <IconChevron direction="right" />
              </button>
            </div>
          );
        })()}
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

      {/* ── Plant page overlay ── */}
      {openPlantData && renderPlantPage(openPlantData)}

      {/* ── Undo bar for a just-deleted care log ── */}
      {pendingDelete && (
        <div className="toast" role="status">
          <span>{pendingDelete.log.careType} deleted</span>
          <button className="toast-action" onClick={undoDeleteCareLog}>
            Undo
          </button>
        </div>
      )}

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
            What did you do? Pick all that apply.
          </span>
          <div
            className="care-type-grid"
            role="group"
            aria-labelledby="care-type-label"
          >
            {CARE_TYPES.map((type) => {
              const selected = careForm.careTypes.includes(type);
              return (
                <button
                  key={type}
                  // aria-pressed tells screen readers each one is an
                  // on/off toggle, since several can be on at once
                  aria-pressed={selected}
                  className={[
                    "care-type",
                    type === "Drama" ? "care-type-drama" : "",
                    selected ? "care-type-selected" : "",
                  ].join(" ")}
                  // tap toggles: add it if it's off, remove it if it's on
                  onClick={() =>
                    setCareForm({
                      ...careForm,
                      careTypes: selected
                        ? careForm.careTypes.filter((t) => t !== type)
                        : [...careForm.careTypes, type],
                    })
                  }
                >
                  {type}
                </button>
              );
            })}
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
            disabled={careForm.careTypes.length === 0}
            onClick={() => handleLogCare(loggingPlant.plantId)}
          >
            {careForm.careTypes.length === 0
              ? "Pick what you did"
              : careForm.careTypes.length === 1
                ? `Log ${careForm.careTypes[0]}`
                : `Log ${careForm.careTypes.length} kinds of care`}
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
