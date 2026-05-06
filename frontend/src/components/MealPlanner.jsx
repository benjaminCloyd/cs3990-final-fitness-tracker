import React, { useState, useEffect } from "react";
import { apiGetRecipes, apiCreateMealPlan, apiGetMealPlans, apiUpdateMealPlan, apiDeleteMealPlan, apiUpdateProfile, apiGenerateGroceryList, apiGetLatestGrocery, apiToggleGroceryItem, apiDownloadGroceryList } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const MEALS = ["Breakfast", "Lunch", "Dinner", "Snack"];

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

  // Macro Goal States
  const [isEditingGoals, setIsEditingGoals] = useState(false);
  const [goalCals, setGoalCals] = useState(user?.macro_targets?.calories || 2000);
  const [goalProt, setGoalProt] = useState(user?.macro_targets?.protein || 150);
  const [goalCarbs, setGoalCarbs] = useState(user?.macro_targets?.carbs || 250);
  const [goalFat, setGoalFat] = useState(user?.macro_targets?.fat || 70);
  const macroCalsTotal = (parseFloat(goalProt) || 0) * 4 + (parseFloat(goalCarbs) || 0) * 4 + (parseFloat(goalFat) || 0) * 9;
  const macroOverBudget = (parseFloat(goalCals) || 0) > 0 && macroCalsTotal > (parseFloat(goalCals) || 0);

  useEffect(() => {
    const fetchRecipes = async () => {
      try {
        const data = await apiGetRecipes();
        setRecipes(data);
      } catch (err) {
        if (err.message === 'UNAUTHORIZED') logout();
        else showToast("Failed to load recipes.", "error");
      }
    };
    fetchRecipes();
    loadMealPlans();
    fetchLatestGrocery();
  }, [logout, showToast]);

  useEffect(() => {
    if (user?.macro_targets) {
      setGoalCals(user.macro_targets.calories);
      setGoalProt(user.macro_targets.protein);
      setGoalCarbs(user.macro_targets.carbs);
      setGoalFat(user.macro_targets.fat);
    }
  }, [user]);

  const loadMealPlans = async () => {
    try {
      const data = await apiGetMealPlans();
      setMealPlans(data);
    } catch (err) {
      if (err.message === 'UNAUTHORIZED') logout();
      else showToast("Failed to load meal plans.", "error");
    }
  };

  const fetchLatestGrocery = async () => {
    try {
      const data = await apiGetLatestGrocery();
      setGroceryList(data);
    } catch (err) {
      console.error("No recent grocery list found.");
    }
  };

  const handleSlotChange = (day, meal, recipeId) => {
    setPlanSlots(prev => ({
      ...prev,
      [`${day}_${meal}`]: recipeId
    }));
  };

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
    setSelectedPlanId(null)
    setIsViewingGrocery(false);
    setWeekStartDate("");
    setPlanSlots({});
  };

  const handleCancel = () => {
    if (isEditing && selectedPlan) {
      // Revert to original data
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

  const formatDate = (dateStr) => {
    if (!dateStr) return { year: "", monthDay: "NEW PLAN" };
    // Handle YYYY-MM-DD (standard) or MM/DD/YYYY (legacy)
    const parts = dateStr.includes("-") ? dateStr.split("-") : dateStr.split("/");
    let y, m, d;
    if (dateStr.includes("-")) {
      [y, m, d] = parts;
    } else {
      [m, d, y] = parts;
    }
    const monthNames = ["JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE", "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER"];
    return {
      year: y,
      monthDay: `${monthNames[parseInt(m, 10) - 1] || '???'} ${parseInt(d, 10) || ''}`
    };
  };

  const calculateDailyTotals = (day) => {
    const totals = { calories: 0, protein: 0, carbs: 0, fat: 0 };
    MEALS.forEach(meal => {
      const id = planSlots[`${day}_${meal}`];
      const recipe = recipes.find(r => (r.id || r._id) === id);
      if (recipe) {
        totals.calories += recipe.calories_per_serving || 0;
        totals.protein += recipe.protein_per_serving || 0;
        totals.carbs += recipe.carbs_per_serving || 0;
        totals.fat += recipe.fat_per_serving || 0;
      }
    });
    return totals;
  };

  const handleSavePlan = async () => {
    if (!weekStartDate) {
      showToast("Please select a week start date.", "error");
      return;
    }
    try {
      setLoading(true);
      await apiCreateMealPlan({
        week_start_date: weekStartDate,
        slots: planSlots
      });
      showToast("Meal plan saved successfully!");
      setIsCreating(false);
      loadMealPlans();
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveUpdate = async () => {
    if (!weekStartDate) {
      showToast("Please select a week start date.", "error");
      return;
    }
    try {
      setLoading(true);
      const planId = selectedPlan.id || selectedPlan._id;
      await apiUpdateMealPlan(planId, {
        week_start_date: weekStartDate,
        slots: planSlots
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
      setMealPlans(prev => prev.filter(p => (p.id || p._id) !== id));
      if (selectedPlan && (selectedPlan.id === id || selectedPlan._id === id)) {
        setSelectedPlanId(null);
        handleCancel();
      }
      showToast("Meal plan deleted.");
    } catch (err) {
      if (err.message === 'UNAUTHORIZED') logout();
      else showToast(err.message, "error");
    }
  };

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
      const newList = { ...groceryList };
      newList.is_checked[idx] = !newList.is_checked[idx];
      setGroceryList(newList);
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
      const a = document.createElement('a');
      a.href = url;
      a.download = `grocery_list_${groceryList.id || groceryList._id}.txt`;
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

  const handleSaveGoals = async () => {
    try {
      setLoading(true);
      await apiUpdateProfile({
        macro_targets: {
          calories: parseFloat(goalCals),
          protein: parseFloat(goalProt),
          carbs: parseFloat(goalCarbs),
          fat: parseFloat(goalFat)
        }
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

  return (
    <div className="recipes-layout" style={{ height: 'calc(100vh - 120px)' }}>
      {/* ── LEFT COLUMN: Saved Meal Plans List ── */}
      <div className="recipes-list-column" style={{ display: 'flex', flexDirection: 'column' }}>
        <div className="sidebar-header">
          <h2>WEEKLY PLANS</h2>
        </div>
        <div className="session-list" style={{ flex: 1, overflowY: 'auto' }}>
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
                  className={`session-item ${selectedPlanId === (p.id || p._id) ? 'selected' : ''}`}
                  onClick={() => handleSelectPlan(p)}
                >
                  <div className="session-item-body">
                    <div className="s-date">{year}</div>
                    <div className="s-name">{monthDay}</div>
                    <div className="s-meta">{Object.keys(p.slots || {}).length} Meals</div>
                  </div>
                  <button
                    className="btn-danger del-btn"
                    onClick={(e) => handleDeletePlan(p.id || p._id, e)}
                  >
                    DEL
                  </button>
                </div>
              );
            })
          )}
        </div>
        <div style={{ padding: '15px', borderTop: '1px solid var(--border)' }}>
          <button className={`btn btn-primary btn-full ${isCreating ? 'selected' : ''}`} onClick={startNewPlan}>
            + GENERATE NEW PLAN
          </button>
        </div>
      </div>

      {/* ── RIGHT COLUMN: Planner Detail ── */}
      <div className="session-detail" style={{ display: 'flex', flexDirection: 'column' }}>
        {/* ── MACRO GOAL BANNER ── */}
        <div style={{
          background: 'var(--surface1)',
          borderBottom: '1px solid var(--border)',
          padding: '15px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          flexShrink: 0
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', fontWeight: 'bold', letterSpacing: '1px', color: '#888' }}>DAILY TARGETS</span>
            {!isEditingGoals ? (
              <button className="btn btn-ghost btn-sm" onClick={() => setIsEditingGoals(true)} disabled={isViewingGrocery}>EDIT GOALS</button>
            ) : (
              <div style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
                {/* Inputs */}
                <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div className="form-row" style={{ marginBottom: 0 }}>
                    <label style={{ fontSize: '9px' }}>CALORIES</label>
                    <input type="number" className="input-base" style={{ padding: '5px' }}
                      value={goalCals} onChange={(e) => setGoalCals(e.target.value)} />
                  </div>
                  <div className="form-row" style={{ marginBottom: 0 }}>
                    <label style={{ fontSize: '9px' }}>PROTEIN (G)</label>
                    <input type="number" className="input-base" style={{ padding: '5px' }}
                      value={goalProt} onChange={(e) => setGoalProt(e.target.value)} />
                  </div>
                  <div className="form-row" style={{ marginBottom: 0 }}>
                    <label style={{ fontSize: '9px' }}>CARBS (G)</label>
                    <input type="number" className="input-base" style={{ padding: '5px' }}
                      value={goalCarbs} onChange={(e) => setGoalCarbs(e.target.value)} />
                  </div>
                  <div className="form-row" style={{ marginBottom: 0 }}>
                    <label style={{ fontSize: '9px' }}>FAT (G)</label>
                    <input type="number" className="input-base" style={{ padding: '5px' }}
                      value={goalFat} onChange={(e) => setGoalFat(e.target.value)} />
                  </div>
                </div>

                {/* Pie chart */}
                <MacroRing
                  goalCals={goalCals} goalProt={goalProt}
                  goalCarbs={goalCarbs} goalFat={goalFat}
                />
              </div>
            )}
          </div>

          {!isEditingGoals ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
              {/* Calories */}
              <div className="stat-box" style={{
                padding: '8px 12px',
                border: '1px solid #333',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <div className="stat-val" style={{ fontSize: '2.2rem', fontWeight: 'bold', color: '#f5c518' }}>{goalCals}</div>
                <div className="stat-label" style={{ fontSize: '0.7rem', textAlign: 'right', marginBottom: '0' }}>CALORIES</div>
              </div>
              {/* Protein */}
              <div className="stat-box" style={{
                padding: '8px 12px',
                border: '1px solid #333',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <div className="stat-val" style={{ fontSize: '2.2rem', fontWeight: 'bold', color: '#1E90FF' }}>{goalProt}g</div>
                <div className="stat-label" style={{ fontSize: '0.7rem', textAlign: 'right', marginBottom: '0' }}>PROTEIN</div>
              </div>
              {/* Carbs */}
              <div className="stat-box" style={{
                padding: '8px 12px',
                border: '1px solid #333',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <div className="stat-val" style={{ fontSize: '2.2rem', fontWeight: 'bold', color: '#ff69b4' }}>{goalCarbs}g</div>
                <div className="stat-label" style={{ fontSize: '0.7rem', textAlign: 'right', marginBottom: '0' }}>CARBS</div>
              </div>
              {/* Fat */}
              <div className="stat-box" style={{
                padding: '8px 12px',
                border: '1px solid #333',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <div className="stat-val" style={{ fontSize: '2.2rem', fontWeight: 'bold', color: '#32CD32' }}>{goalFat}g</div>
                <div className="stat-label" style={{ fontSize: '0.7rem', textAlign: 'right', marginBottom: '0' }}>FAT</div>
              </div>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '15px' }}>
              <div className="form-row" style={{ marginBottom: 0 }}>
                <label style={{ fontSize: '9px' }}>CALORIES</label>
                <input type="number" className="input-base" style={{ padding: '5px' }}
                  value={goalCals} onChange={(e) => setGoalCals(e.target.value)} />
              </div>
              <div className="form-row" style={{ marginBottom: 0 }}>
                <label style={{ fontSize: '9px' }}>PROTEIN (G)</label>
                <input type="number" className="input-base" style={{ padding: '5px' }}
                  value={goalProt} onChange={(e) => setGoalProt(e.target.value)} />
              </div>
              <div className="form-row" style={{ marginBottom: 0 }}>
                <label style={{ fontSize: '9px' }}>CARBS (G)</label>
                <input type="number" className="input-base" style={{ padding: '5px' }}
                  value={goalCarbs} onChange={(e) => setGoalCarbs(e.target.value)} />
              </div>
              <div className="form-row" style={{ marginBottom: 0 }}>
                <label style={{ fontSize: '9px' }}>FAT (G)</label>
                <input type="number" className="input-base" style={{ padding: '5px' }}
                  value={goalFat} onChange={(e) => setGoalFat(e.target.value)} />
              </div>
            </div>
          )}
        </div>

        {isCreating || selectedPlan || isEditing ? (
          <div className="meal-planner-layout" style={{ padding: '20px', overflowY: 'auto', flex: 1 }}>
            <div className="detail-header" style={{ marginBottom: '30px', borderBottom: '1px solid var(--border)', paddingBottom: '20px' }}>
              <div>
                {isViewingGrocery ? (
                  <h1 className="session-title">GROCERY LIST</h1>
                ) : (
                  <>
                    <h1 className="session-title">
                      {isCreating ? "NEW MEAL PLAN" : isEditing ? "EDIT MEAL PLAN" : "VIEW MEAL PLAN"}
                    </h1>
                    <div className="form-row" style={{ marginTop: '10px' }}>
                      <label>WEEK START DATE</label>
                      <input
                        type="date"
                        className="input-base"
                        style={{ width: 'auto', background: '#1a1a1a', color: 'white', border: '1px solid #333', padding: '8px' }}
                        value={weekStartDate}
                        disabled={!isCreating && !isEditing}
                        onChange={(e) => setWeekStartDate(e.target.value)}
                      />
                    </div>
                  </>
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'flex-end' }}>
                {isViewingGrocery ? (
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button
                      className="btn btn-primary"
                      onClick={handleDownloadList}
                      disabled={loading}
                    >DOWNLOAD LIST</button>
                    <button className="btn btn-ghost" onClick={() => setIsViewingGrocery(false)}>BACK TO PLAN</button>
                  </div>
                ) : (
                  <>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      {!isCreating && !isEditing && (
                        <button className="btn btn-primary" onClick={() => setIsEditing(true)}>EDIT</button>
                      )}
                      {(isCreating || isEditing) && (
                        <button
                          className="btn btn-primary"
                          onClick={isCreating ? handleSavePlan : handleSaveUpdate}
                          disabled={loading || macroOverBudget}
                        >
                          {loading ? "SAVING..." : "SAVE PLAN"}
                        </button>
                      )}
                      <button className="btn btn-ghost" onClick={handleCancel}>CANCEL</button>
                    </div>
                    {selectedPlan && !isEditing && (
                      <button className="btn btn-ghost" onClick={handleGenerateList} disabled={loading} style={{ width: '100%' }}> GROCERY LIST </button>
                    )}
                  </>
                )}
              </div>
            </div>

            {isViewingGrocery && groceryList ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '15px' }}>
                {groceryList.items.map((item, idx) => (
                  <div
                    key={idx}
                    onClick={() => handleToggleItem(idx)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '15px',
                      padding: '15px',
                      background: 'var(--surface2)',
                      border: '1px solid var(--border)',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      opacity: groceryList.is_checked[idx] ? 0.4 : 1,
                      textDecoration: groceryList.is_checked[idx] ? 'line-through' : 'none',
                      transition: 'all 0.2s ease'
                    }}>
                    <input type="checkbox" checked={groceryList.is_checked[idx]} readOnly style={{ cursor: 'pointer' }} />
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontSize: '1rem', fontWeight: 'bold' }}>{item.name}</span>
                      <span style={{ fontSize: '0.8rem', color: 'var(--green)' }}>
                        {/^\d+(\.\d+)?$/.test(item.quantity.trim()) ? `${item.quantity} g` : item.quantity}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : ( /* Display Meal Plan Grid */
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' }}>
                {DAYS.map(day => {
                  const totals = calculateDailyTotals(day);
                  const targets = {
                    calories: parseFloat(goalCals) || 0,
                    protein: parseFloat(goalProt) || 0,
                    carbs: parseFloat(goalCarbs) || 0,
                    fat: parseFloat(goalFat) || 0
                  };

                  return (
                    <div key={day} className="exercise-card" style={{ padding: '20px', background: 'var(--surface2)' }}>
                      <h3 style={{ color: 'var(--green)', borderBottom: '1px solid #333', paddingBottom: '10px', marginBottom: '15px' }}>{day.toUpperCase()}</h3>

                      {MEALS.map(meal => (
                        <div key={meal} style={{ marginBottom: '15px' }}>
                          <label style={{ display: 'block', fontSize: '10px', color: '#888', marginBottom: '5px' }}>{meal.toUpperCase()}</label>
                          <select
                            className="input-base"
                            style={{ width: '100%', background: '#111', border: '1px solid #333', color: 'white' }}
                            value={planSlots[`${day}_${meal}`] || ""}
                            disabled={!isCreating && !isEditing}
                            onChange={(e) => handleSlotChange(day, meal, e.target.value)}
                          >
                            <option value="">— SELECT RECIPE —</option>
                            {recipes.map(r => (
                              <option key={r.id || r._id} value={r.id || r._id}>{r.name}</option>
                            ))}
                          </select>
                        </div>
                      ))}

                      <div style={{ marginTop: '20px', padding: '12px', background: '#000', borderRadius: '4px', border: '1px solid #222' }}>
                        <div style={{ fontSize: '0.75rem', fontFamily: 'JetBrains Mono' }}>
                          <div style={{ marginBottom: '8px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', color: totals.calories > targets.calories ? '#ff4444' : 'white' }}>
                              <span>CALORIES</span>
                              <span>{totals.calories.toFixed(0)} / {targets.calories}</span>
                            </div>
                            <div style={{ width: '100%', height: '5px', background: '#333', borderRadius: '2px', marginTop: '4px' }}>
                              <div style={{
                                width: `${Math.min(100, targets.calories === 0 ? (totals.calories > 0 ? 100 : 0) : (totals.calories / targets.calories) * 100)}%`,
                                height: '100%',
                                background: totals.calories > targets.calories ? '#ff4444' : '#f5c518',
                                borderRadius: '2px'
                              }}></div>
                            </div>
                          </div>

                          <div style={{ marginBottom: '8px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', color: totals.protein > targets.protein ? '#ff4444' : 'white' }}>
                              <span>PROTEIN</span>
                              <span>{totals.protein.toFixed(0)}g / {targets.protein}g</span>
                            </div>
                            <div style={{ width: '100%', height: '5px', background: '#333', borderRadius: '2px', marginTop: '4px' }}>
                              <div style={{
                                width: `${Math.min(100, targets.protein === 0 ? (totals.protein > 0 ? 100 : 0) : (totals.protein / targets.protein) * 100)}%`,
                                height: '100%',
                                background: totals.protein > targets.protein ? '#ff4444' : '#1E90FF',
                                borderRadius: '2px'
                              }}></div>
                            </div>
                          </div>

                          <div style={{ marginBottom: '8px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', color: totals.carbs > targets.carbs ? '#ff4444' : 'white' }}>
                              <span>CARBS</span>
                              <span>{totals.carbs.toFixed(0)}g / {targets.carbs}g</span>
                            </div>
                            <div style={{ width: '100%', height: '5px', background: '#333', borderRadius: '2px', marginTop: '4px' }}>
                              <div style={{
                                width: `${Math.min(100, targets.carbs === 0 ? (totals.carbs > 0 ? 100 : 0) : (totals.carbs / targets.carbs) * 100)}%`,
                                height: '100%',
                                background: totals.carbs > targets.carbs ? '#ff4444' : '#ff69b4',
                                borderRadius: '2px'
                              }}></div>
                            </div>
                          </div>

                          <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', color: totals.fat > targets.fat ? '#ff4444' : 'white' }}>
                              <span>FAT</span>
                              <span>{totals.fat.toFixed(0)}g / {targets.fat}g</span>
                            </div>
                            <div style={{ width: '100%', height: '5px', background: '#333', borderRadius: '2px', marginTop: '4px' }}>
                              <div style={{
                                width: `${Math.min(100, targets.fat === 0 ? (totals.fat > 0 ? 100 : 0) : (totals.fat / targets.fat) * 100)}%`,
                                height: '100%',
                                background: totals.fat > targets.fat ? '#ff4444' : '#32CD32',
                                borderRadius: '2px'
                              }}></div>
                            </div>
                          </div>
                        </div>
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



function MacroRing({ goalCals, goalProt, goalCarbs, goalFat }) {
  const cals = parseFloat(goalCals) || 0;
  const prot = parseFloat(goalProt) || 0;
  const carbs = parseFloat(goalCarbs) || 0;
  const fat = parseFloat(goalFat) || 0;

  const protCal = prot * 4;
  const carbCal = carbs * 4;
  const fatCal = fat * 9;
  const totalMacroCal = protCal + carbCal + fatCal;
  const overBudget = cals > 0 && totalMacroCal > cals;

  const SIZE = 160, cx = 80, cy = 80, R = 58, SW = 22;
  const circ = 2 * Math.PI * R;

  const segs = [
    { value: protCal, color: '#1E90FF', label: 'PRO' },
    { value: carbCal, color: '#ff69b4', label: 'CHO' },
    { value: fatCal, color: '#32CD32', label: 'FAT' },
  ];

  let acc = 0;
  const arcs = totalMacroCal > 0 ? segs.map(seg => {
    const frac = seg.value / totalMacroCal;
    const dash = frac * circ;
    const gap = circ - dash;
    const rot = (acc / totalMacroCal) * 360 - 90;
    acc += seg.value;
    return { ...seg, dash, gap, rot, pct: Math.round(frac * 100) };
  }) : [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', minWidth: '160px' }}>
      <svg width={SIZE} height={SIZE} viewBox="0 0 160 160">
        <circle cx={cx} cy={cy} r={R} fill="none" stroke="#1a1a1a" strokeWidth={SW} />
        {arcs.map((a, i) => (
          <circle key={i} cx={cx} cy={cy} r={R}
            fill="none" stroke={a.color} strokeWidth={SW}
            strokeDasharray={`${a.dash} ${a.gap}`}
            transform={`rotate(${a.rot} ${cx} ${cy})`}
          />
        ))}
        <text x={cx} y={cy - 7} textAnchor="middle"
          fill={overBudget ? '#ff4444' : '#f5c518'}
          style={{ fontFamily: 'Bebas Neue, sans-serif', fontSize: '22px' }}>
          {totalMacroCal.toFixed(0)}
        </text>
        <text x={cx} y={cy + 10} textAnchor="middle"
          fill="#555"
          style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '9px' }}>
          of {cals} kcal
        </text>
      </svg>

      {/* Legend */}
      <div style={{ display: 'flex', gap: '10px', fontSize: '9px', fontFamily: 'JetBrains Mono, monospace' }}>
        {arcs.map((a, i) => (
          <span key={i} style={{ color: a.color, display: 'flex', alignItems: 'center', gap: '3px' }}>
            <span style={{ width: 6, height: 6, background: a.color, borderRadius: '50%', display: 'inline-block' }} />
            {a.label} {a.pct}%
          </span>
        ))}
      </div>

      {overBudget && (
        <div style={{ color: '#ff4444', fontSize: '9px', fontFamily: 'JetBrains Mono, monospace', letterSpacing: '1px', textAlign: 'center' }}>
          ⚠ MACROS EXCEED CALORIE GOAL
        </div>
      )}
    </div>
  );
}