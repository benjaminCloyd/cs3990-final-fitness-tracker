import React, { useState, useEffect } from "react";
import {
  apiGetRecipes,
  apiCreateMealPlan,
  apiGetMealPlans,
  apiUpdateMealPlan,
  apiDeleteMealPlan,
  apiUpdateProfile,
  apiGenerateGroceryList,
  apiGetLatestGrocery,
  apiToggleGroceryItem,
  apiDownloadGroceryList,
} from "../api.js";
import { useAuth } from "../context/AuthContext.jsx";
import { useToast } from "../context/ToastContext.jsx";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const MEALS = ["Breakfast", "Lunch", "Dinner", "Snack"];

// ── Donut chart for macro distribution ───────────────────────────────────────

function MacroRing({ goalCals, goalProt, goalCarbs, goalFat }) {
  const cals = parseFloat(goalCals) || 0;
  const prot = parseFloat(goalProt) || 0;
  const carbs = parseFloat(goalCarbs) || 0;
  const fat = parseFloat(goalFat) || 0;

  const protCal = prot * 4;
  const carbCal = carbs * 4;
  const fatCal = fat * 9;
  const totalMacroCal = protCal + carbCal + fatCal;
  const overBudget = cals > 0 && totalMacroCal > (cals + 5); // Add small margin for rounding

  const SIZE = 160, cx = 80, cy = 80, R = 58, SW = 22;
  const circ = 2 * Math.PI * R;

  const segs = [
    { value: protCal, color: "#1E90FF", label: "PRO" },
    { value: carbCal, color: "#ff69b4", label: "CHO" },
    { value: fatCal, color: "#32CD32", label: "FAT" },
  ];

  let acc = 0;
  const arcs = totalMacroCal > 0
    ? segs.map((seg) => {
      const frac = seg.value / totalMacroCal;
      const dash = frac * circ;
      const gap = circ - dash;
      const rot = (acc / totalMacroCal) * 360 - 90;
      acc += seg.value;
      return { ...seg, dash, gap, rot, pct: Math.round(frac * 100) };
    })
    : [];

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "8px", minWidth: "160px" }}>
      <svg width={SIZE} height={SIZE} viewBox="0 0 160 160">
        {/* Track */}
        <circle cx={cx} cy={cy} r={R} fill="none" stroke="#1a1a1a" strokeWidth={SW} />

        {/* Segments */}
        {arcs.map((a, i) => (
          <circle
            key={i} cx={cx} cy={cy} r={R}
            fill="none" stroke={a.color} strokeWidth={SW}
            strokeDasharray={`${a.dash} ${a.gap}`}
            transform={`rotate(${a.rot} ${cx} ${cy})`}
            style={{ transition: "stroke-dasharray 0.4s ease" }}
          />
        ))}

        {/* Centre text — total macro kcal */}
        <text x={cx} y={cy - 6} textAnchor="middle"
          fill={overBudget ? "#ff4444" : "#f5c518"}
          style={{ fontFamily: "Bebas Neue, sans-serif", fontSize: "20px", letterSpacing: "1px" }}>
          {totalMacroCal.toFixed(0)}
        </text>
        <text x={cx} y={cy + 9} textAnchor="middle"
          fill="#444"
          style={{ fontFamily: "JetBrains Mono, monospace", fontSize: "8px" }}>
          of {cals} kcal
        </text>
      </svg>

      {/* Legend */}
      <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", justifyContent: "center" }}>
        {arcs.map((a, i) => (
          <span key={i} style={{
            display: "flex", alignItems: "center", gap: "4px",
            fontFamily: "JetBrains Mono, monospace", fontSize: "9px", color: a.color
          }}>
            <span style={{
              width: 6, height: 6, borderRadius: "50%",
              background: a.color, display: "inline-block"
            }} />
            {a.label} {a.pct}%
          </span>
        ))}
      </div>

      {overBudget && (
        <div style={{
          color: "#ff4444", fontSize: "8px", fontFamily: "JetBrains Mono, monospace",
          letterSpacing: "1px", textAlign: "center", marginTop: "2px"
        }}>
          ⚠ MACROS EXCEED CALORIE GOAL
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

const MealPlanner = () => {
  const { user, logout, refreshUser } = useAuth();
  const { showToast } = useToast();

  const [recipes, setRecipes] = useState([]);
  const [mealPlans, setMealPlans] = useState([]);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [selectedPlanId, setSelectedPlanId] = useState(null);
  const [weekStartDate, setWeekStartDate] = useState("");
  const [planSlots, setPlanSlots] = useState({});
  const [loading, setLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [groceryList, setGroceryList] = useState(null);
  const [isViewingGrocery, setIsViewingGrocery] = useState(false);

  // Macro goal state
  const [isEditingGoals, setIsEditingGoals] = useState(false);
  const [goalCals, setGoalCals] = useState(user?.macro_targets?.calories || 2000);

  // Percent-based macro state
  const [pctProt, setPctProt] = useState(30);
  const [pctCarbs, setPctCarbs] = useState(40);
  const [pctFat, setPctFat] = useState(30);

  // Derived Grams
  const goalProt = (parseFloat(goalCals) * (parseFloat(pctProt) / 100)) / 4;
  const goalCarbs = (parseFloat(goalCals) * (parseFloat(pctCarbs) / 100)) / 4;
  const goalFat = (parseFloat(goalCals) * (parseFloat(pctFat) / 100)) / 9;

  // Validation
  const totalPct = parseFloat(pctProt) + parseFloat(pctCarbs) + parseFloat(pctFat);
  const pctError = totalPct !== 100;

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  useEffect(() => {
    const fetchRecipes = async () => {
      try {
        setRecipes(await apiGetRecipes());
      } catch (err) {
        if (err.message === "UNAUTHORIZED") logout();
        else showToast("Failed to load recipes.", "error");
      }
    };
    fetchRecipes();
    loadMealPlans();
    fetchLatestGrocery();
  }, []);

  useEffect(() => {
    if (user?.macro_targets) {
      const { calories, protein, carbs, fat } = user.macro_targets;
      setGoalCals(calories);
      // Reverse calculate percentages to match saved grams
      if (calories > 0) {
        setPctProt(Math.round(((protein * 4) / calories) * 100));
        setPctCarbs(Math.round(((carbs * 4) / calories) * 100));
        setPctFat(Math.round(((fat * 9) / calories) * 100));
      }
    }
  }, [user]);

  // ── Data helpers ───────────────────────────────────────────────────────────

  const loadMealPlans = async () => {
    try {
      setMealPlans(await apiGetMealPlans());
    } catch (err) {
      if (err.message === "UNAUTHORIZED") logout();
      else showToast("Failed to load meal plans.", "error");
    }
  };

  const fetchLatestGrocery = async () => {
    try {
      setGroceryList(await apiGetLatestGrocery());
    } catch (_) { }
  };

  // ── Slot helpers ───────────────────────────────────────────────────────────

  const handleSlotChange = (day, meal, recipeId) => {
    setPlanSlots((prev) => ({ ...prev, [`${day}_${meal}`]: recipeId }));
  };

  const calculateDailyTotals = (day) => {
    const t = { calories: 0, protein: 0, carbs: 0, fat: 0 };
    MEALS.forEach((meal) => {
      const id = planSlots[`${day}_${meal}`];
      const r = recipes.find((r) => (r.id || r._id) === id);
      if (r) {
        t.calories += r.calories_per_serving || 0;
        t.protein += r.protein_per_serving || 0;
        t.carbs += r.carbs_per_serving || 0;
        t.fat += r.fat_per_serving || 0;
      }
    });
    return t;
  };

  // ── Plan selection / navigation ────────────────────────────────────────────

  const handleSelectPlan = (plan) => {
    setSelectedPlan(plan);
    setSelectedPlanId(plan.id || plan._id);
    setIsCreating(false);
    setIsEditing(false);
    setIsViewingGrocery(false);
    setWeekStartDate(plan.week_start_date);
    setPlanSlots(plan.slots || {});
  };

  const startNewPlan = () => {
    setIsCreating(true);
    setIsEditing(false);
    setSelectedPlan(null);
    setSelectedPlanId(null);
    setIsViewingGrocery(false);
    setWeekStartDate("");
    setPlanSlots({});
  };

  const handleCancel = () => {
    if (isEditing && selectedPlan) {
      setWeekStartDate(selectedPlan.week_start_date);
      setPlanSlots(selectedPlan.slots || {});
    } else {
      setSelectedPlan(null);
      setSelectedPlanId(null);
      setWeekStartDate("");
      setPlanSlots({});
    }
    setIsCreating(false);
    setIsEditing(false);
    setIsViewingGrocery(false);
  };

  // ── CRUD ───────────────────────────────────────────────────────────────────

  const handleSavePlan = async () => {
    if (!weekStartDate) { showToast("Please select a week start date.", "error"); return; }
    try {
      setLoading(true);
      await apiCreateMealPlan({ week_start_date: weekStartDate, slots: planSlots });
      showToast("Meal plan saved!");
      setIsCreating(false);
      loadMealPlans();
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveUpdate = async () => {
    if (!weekStartDate) { showToast("Please select a week start date.", "error"); return; }
    try {
      setLoading(true);
      await apiUpdateMealPlan(selectedPlan.id || selectedPlan._id, {
        week_start_date: weekStartDate, slots: planSlots,
      });
      showToast("Meal plan updated!");
      setIsEditing(false);
      loadMealPlans();
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePlan = async (id, e) => {
    e.stopPropagation();
    if (!window.confirm("Delete this meal plan?")) return;
    try {
      await apiDeleteMealPlan(id);
      setMealPlans((prev) => prev.filter((p) => (p.id || p._id) !== id));
      if (selectedPlan && (selectedPlan.id === id || selectedPlan._id === id)) handleCancel();
      showToast("Meal plan deleted.");
    } catch (err) {
      if (err.message === "UNAUTHORIZED") logout();
      else showToast(err.message, "error");
    }
  };

  const handleSaveGoals = async () => {
    if (pctError) return;
    try {
      setLoading(true);
      await apiUpdateProfile({
        macro_targets: {
          calories: parseFloat(goalCals),
          protein: Math.round(goalProt),
          carbs: Math.round(goalCarbs),
          fat: Math.round(goalFat),
        },
      });
      await refreshUser();
      showToast("Macro targets updated!");
      setIsEditingGoals(false);
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setLoading(false);
    }
  };

  // ── Grocery ────────────────────────────────────────────────────────────────

  const handleGenerateList = async () => {
    if (!selectedPlan) return;
    try {
      setLoading(true);
      const data = await apiGenerateGroceryList(selectedPlan.id || selectedPlan._id);
      setGroceryList(data);
      setIsViewingGrocery(true);
      showToast("Grocery list generated!");
    } catch (err) {
      showToast("Failed to generate list.", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleToggleItem = async (idx) => {
    if (!groceryList) return;
    try {
      await apiToggleGroceryItem(groceryList.id || groceryList._id, idx);
      setGroceryList((prev) => {
        const next = { ...prev, is_checked: [...prev.is_checked] };
        next.is_checked[idx] = !next.is_checked[idx];
        return next;
      });
    } catch (err) {
      showToast("Error updating item.", "error");
    }
  };

  const handleDownloadList = async () => {
    if (!groceryList) return;
    try {
      setLoading(true);
      const blob = await apiDownloadGroceryList(groceryList.id || groceryList._id);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `grocery_list.txt`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      showToast("Failed to download grocery list.", "error");
    } finally {
      setLoading(false);
    }
  };

  // ── Date formatting ────────────────────────────────────────────────────────

  const formatDate = (dateStr) => {
    if (!dateStr) return { year: "", monthDay: "NEW PLAN" };
    const isISO = dateStr.includes("-");
    const [y, m, d] = isISO
      ? dateStr.split("-")
      : [dateStr.split("/")[2], dateStr.split("/")[0], dateStr.split("/")[1]];
    const months = ["JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE",
      "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER"];
    return { year: y, monthDay: `${months[parseInt(m, 10) - 1] || "???"} ${parseInt(d, 10) || ""}` };
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  const isActive = isCreating || !!selectedPlan || isEditing;

  return (
    <div className="recipes-layout" style={{ height: "calc(100vh - 120px)" }}>

      {/* ── LEFT COLUMN: Saved Plans ── */}
      <div className="recipes-list-column" style={{ display: "flex", flexDirection: "column" }}>
        <div className="sidebar-header"><h2>WEEKLY PLANS</h2></div>

        <div className="session-list" style={{ flex: 1, overflowY: "auto" }}>
          {mealPlans.length === 0 ? (
            <div className="empty-state">
              <p>No saved plans.<br />Create your first one.</p>
            </div>
          ) : (
            mealPlans.map((p) => {
              const { year, monthDay } = formatDate(p.week_start_date);
              return (
                <div
                  key={p.id || p._id}
                  className={`session-item ${selectedPlanId === (p.id || p._id) ? "selected" : ""}`}
                  onClick={() => handleSelectPlan(p)}
                >
                  <div className="session-item-body">
                    <div className="s-date">{year}</div>
                    <div className="s-name">{monthDay}</div>
                    <div className="s-meta">{Object.keys(p.slots || {}).length} Meals</div>
                  </div>
                  <button className="btn-danger del-btn"
                    onClick={(e) => handleDeletePlan(p.id || p._id, e)}>
                    DEL
                  </button>
                </div>
              );
            })
          )}
        </div>

        <div style={{ padding: "15px", borderTop: "1px solid var(--border)" }}>
          <button className="btn btn-primary btn-full" onClick={startNewPlan}>
            + GENERATE NEW PLAN
          </button>
        </div>
      </div>

      {/* ── RIGHT COLUMN: Planner Detail ── */}
      <div className="session-detail" style={{ display: "flex", flexDirection: "column" }}>

        {/* ── MACRO GOAL BANNER ── */}
        <div style={{
          background: "var(--surface1)", borderBottom: "1px solid var(--border)",
          padding: "15px 20px", display: "flex", flexDirection: "column", gap: "10px", flexShrink: 0
        }}>
          {/* Header row */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "12px", fontWeight: "bold", letterSpacing: "1px", color: "#888" }}>
              DAILY TARGETS
            </span>
            {!isEditingGoals ? (
              <button className="btn btn-ghost btn-sm"
                onClick={() => setIsEditingGoals(true)}
                disabled={isViewingGrocery}>
                EDIT GOALS
              </button>
            ) : (
              <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                {pctError && (
                  <span style={{
                    fontFamily: "JetBrains Mono, monospace", fontSize: "9px",
                    color: "#ff4444", letterSpacing: "1px"
                  }}>
                    ⚠ MUST EQUAL 100%
                  </span>
                )}
                <button className="btn btn-ghost btn-sm"
                  onClick={() => setIsEditingGoals(false)}>
                  CANCEL
                </button>
                <button className="btn btn-ghost btn-sm"
                  onClick={handleSaveGoals}
                  disabled={loading || pctError}
                  style={pctError ? { opacity: 0.4, cursor: "not-allowed" } : {}}>
                  SAVE
                </button>
              </div>
            )}
          </div>

          {/* Display mode */}
          {!isEditingGoals ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "10px" }}>
              {[
                { val: goalCals, label: "CALORIES", color: "#f5c518", unit: "" },
                { val: Math.round(goalProt), label: "PROTEIN", color: "#1E90FF", unit: "g" },
                { val: Math.round(goalCarbs), label: "CARBS", color: "#ff69b4", unit: "g" },
                { val: Math.round(goalFat), label: "FAT", color: "#32CD32", unit: "g" },
              ].map(({ val, label, color, unit }) => (
                <div key={label} className="stat-box" style={{
                  padding: "8px 12px", border: "1px solid #333",
                  display: "flex", justifyContent: "space-between", alignItems: "center"
                }}>
                  <div className="stat-val" style={{ fontSize: "2.2rem", color }}>
                    {val}{unit}
                  </div>
                  <div className="stat-label" style={{ fontSize: "0.7rem", textAlign: "right", marginBottom: 0 }}>
                    {label}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            /* Edit mode: inputs + pie chart side by side */
            <div style={{ display: "flex", gap: "24px", alignItems: "center" }}>
              <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>

                {/* Calorie Input */}
                <div className="form-row" style={{ marginBottom: 0, gridColumn: "span 2" }}>
                  <label style={{ fontSize: "9px" }}>TOTAL DAILY CALORIES</label>
                  <input
                    type="number"
                    className="input-base"
                    style={{ padding: "8px", fontSize: "1.2rem", color: "#f5c518" }}
                    value={goalCals}
                    onChange={(e) => setGoalCals(e.target.value)}
                  />
                </div>

                {/* Percentage Inputs */}
                {[
                  { label: "PROTEIN (%)", val: pctProt, set: setPctProt, color: "#1E90FF" },
                  { label: "CARBS (%)", val: pctCarbs, set: setPctCarbs, color: "#ff69b4" },
                  { label: "FAT (%)", val: pctFat, set: setPctFat, color: "#32CD32" },
                ].map(({ label, val, set, color }) => (
                  <div key={label} className="form-row" style={{ marginBottom: 0 }}>
                    <label style={{ fontSize: "9px", color }}>{label}</label>
                    <input
                      type="number"
                      className="input-base"
                      style={{ padding: "5px" }}
                      value={val}
                      onChange={(e) => set(e.target.value)}
                    />
                  </div>
                ))}

                {/* Percentage Validation Info */}
                <div style={{
                  gridColumn: "span 2",
                  fontSize: "10px",
                  fontFamily: "JetBrains Mono, monospace",
                  color: pctError ? "#ff4444" : "var(--green)",
                  marginTop: "5px"
                }}>
                  TOTAL: {totalPct}% {pctError && "(Must equal 100%)"}
                </div>
              </div>

              <MacroRing
                goalCals={goalCals} goalProt={goalProt}
                goalCarbs={goalCarbs} goalFat={goalFat}
              />
            </div>
          )}
        </div>

        {/* ── Plan content ── */}
        {isActive ? (
          <div className="meal-planner-layout" style={{ padding: "20px", overflowY: "auto", flex: 1 }}>

            {/* Header */}
            <div className="detail-header" style={{
              marginBottom: "30px", borderBottom: "1px solid var(--border)", paddingBottom: "20px"
            }}>
              <div>
                {isViewingGrocery ? (
                  <h1 className="session-title">GROCERY LIST</h1>
                ) : (
                  <>
                    <h1 className="session-title">
                      {isCreating ? "NEW MEAL PLAN" : isEditing ? "EDIT MEAL PLAN" : "VIEW MEAL PLAN"}
                    </h1>
                    <div className="form-row" style={{ marginTop: "10px" }}>
                      <label>WEEK START DATE</label>
                      <input type="date" className="input-base"
                        style={{
                          width: "auto", background: "#1a1a1a", color: "white",
                          border: "1px solid #333", padding: "8px"
                        }}
                        value={weekStartDate}
                        disabled={!isCreating && !isEditing}
                        onChange={(e) => setWeekStartDate(e.target.value)}
                      />
                    </div>
                  </>
                )}
              </div>

              {/* Actions */}
              <div style={{ display: "flex", flexDirection: "column", gap: "10px", alignItems: "flex-end" }}>
                {isViewingGrocery ? (
                  <div style={{ display: "flex", gap: "10px" }}>
                    <button className="btn btn-primary"
                      onClick={handleDownloadList} disabled={loading}>
                      DOWNLOAD LIST
                    </button>
                    <button className="btn btn-ghost"
                      onClick={() => setIsViewingGrocery(false)}>
                      BACK TO PLAN
                    </button>
                  </div>
                ) : (
                  <>
                    <div style={{ display: "flex", gap: "10px" }}>
                      {!isCreating && !isEditing && (
                        <button className="btn btn-primary"
                          onClick={() => setIsEditing(true)}>
                          EDIT
                        </button>
                      )}
                      {(isCreating || isEditing) && (
                        <button className="btn btn-primary"
                          onClick={isCreating ? handleSavePlan : handleSaveUpdate}
                          disabled={loading}>
                          {loading ? "SAVING..." : "SAVE PLAN"}
                        </button>
                      )}
                      <button className="btn btn-ghost" onClick={handleCancel}>CANCEL</button>
                    </div>
                    {selectedPlan && !isEditing && (
                      <button className="btn btn-ghost"
                        onClick={handleGenerateList} disabled={loading}
                        style={{ width: "100%" }}>
                        GROCERY LIST
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* ── Grocery view ── */}
            {isViewingGrocery && groceryList ? (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "12px" }}>
                {groceryList.items.map((item, idx) => (
                  <div key={idx} onClick={() => handleToggleItem(idx)}
                    style={{
                      display: "flex", alignItems: "center", gap: "12px", padding: "14px",
                      background: "var(--surface2)", border: "1px solid var(--border)",
                      borderRadius: "4px", cursor: "pointer",
                      opacity: groceryList.is_checked[idx] ? 0.35 : 1,
                      textDecoration: groceryList.is_checked[idx] ? "line-through" : "none",
                      transition: "all 0.2s ease",
                    }}>
                    <input type="checkbox" checked={groceryList.is_checked[idx]} readOnly
                      style={{ cursor: "pointer" }} />
                    <div style={{ display: "flex", flexDirection: "column" }}>
                      <span style={{ fontSize: "1rem", fontWeight: "bold" }}>{item.name}</span>
                      <span style={{ fontSize: "0.8rem", color: "var(--green)" }}>
                        {/^\d+(\.\d+)?$/.test(item.quantity.trim())
                          ? `${item.quantity} g` : item.quantity}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

            ) : (
              /* ── Meal plan grid ── */
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "18px" }}>
                {DAYS.map((day) => {
                  const totals = calculateDailyTotals(day);
                  const targets = {
                    calories: parseFloat(goalCals) || 0,
                    protein: Math.round(goalProt) || 0,
                    carbs: Math.round(goalCarbs) || 0,
                    fat: Math.round(goalFat) || 0,
                  };

                  return (
                    <div key={day} className="exercise-card"
                      style={{ padding: "18px", background: "var(--surface2)" }}>
                      {/* Day header */}
                      <h3 style={{
                        color: "var(--green)", borderBottom: "1px solid #333",
                        paddingBottom: "10px", marginBottom: "14px"
                      }}>
                        {day.toUpperCase()}
                      </h3>

                      {/* Meal selectors */}
                      {MEALS.map((meal) => (
                        <div key={meal} style={{ marginBottom: "12px" }}>
                          <label style={{ display: "block", fontSize: "10px", color: "#888", marginBottom: "4px" }}>
                            {meal.toUpperCase()}
                          </label>
                          <select className="input-base"
                            style={{ width: "100%", background: "#111", border: "1px solid #333", color: "white" }}
                            value={planSlots[`${day}_${meal}`] || ""}
                            disabled={!isCreating && !isEditing}
                            onChange={(e) => handleSlotChange(day, meal, e.target.value)}>
                            <option value="">— SELECT RECIPE —</option>
                            {recipes.map((r) => (
                              <option key={r.id || r._id} value={r.id || r._id}>{r.name}</option>
                            ))}
                          </select>
                        </div>
                      ))}

                      {/* Daily macro bars */}
                      <div style={{
                        marginTop: "16px", padding: "10px", background: "#000",
                        borderRadius: "4px", border: "1px solid #1a1a1a"
                      }}>
                        {[
                          { key: "calories", label: "CALORIES", color: "#f5c518", unit: "", decimals: 0 },
                          { key: "protein", label: "PROTEIN", color: "#1E90FF", unit: "g", decimals: 0 },
                          { key: "carbs", label: "CARBS", color: "#ff69b4", unit: "g", decimals: 0 },
                          { key: "fat", label: "FAT", color: "#32CD32", unit: "g", decimals: 0 },
                        ].map(({ key, label, color, unit, decimals }) => {
                          const val = totals[key];
                          const target = targets[key];
                          const over = val > target && target > 0;
                          const pct = target === 0
                            ? (val > 0 ? 100 : 0)
                            : Math.min(100, (val / target) * 100);
                          return (
                            <div key={key} style={{ marginBottom: "8px" }}>
                              <div style={{
                                display: "flex", justifyContent: "space-between",
                                color: over ? "#ff4444" : "white",
                                fontFamily: "JetBrains Mono, monospace", fontSize: "0.7rem"
                              }}>
                                <span>{label}</span>
                                <span>{val.toFixed(decimals)}{unit} / {target}{unit}</span>
                              </div>
                              <div style={{
                                width: "100%", height: "4px", background: "#1a1a1a",
                                borderRadius: "2px", marginTop: "3px"
                              }}>
                                <div style={{
                                  width: `${pct}%`, height: "100%", borderRadius: "2px",
                                  background: over ? "#ff4444" : color,
                                  transition: "width 0.3s ease",
                                }} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <div className="detail-placeholder">
            <p>Select a meal plan from the sidebar<br />or create a new weekly template.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default MealPlanner;
