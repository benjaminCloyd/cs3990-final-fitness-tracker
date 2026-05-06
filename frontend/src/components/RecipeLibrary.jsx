import React, { useState, useEffect } from "react";
import { apiGetRecipes, apiCreateRecipe, apiUpdateRecipe, apiUploadRecipeImage, apiDeleteRecipe } from '../api.js'; 
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';

const RecipeLibrary = () => {
  const { logout } = useAuth();
  const { showToast } = useToast();
  
  // State for data
  const [recipes, setRecipes] = useState([]);
  const [selectedRecipe, setSelectedRecipe] = useState(null);
  const [selectedRecipeId, setSelectedRecipeId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  // Form State for creating
  const [name, setName] = useState('');
  const [instructions, setInstructions] = useState('');
  const [ingredients, setIngredients] = useState([{ name: '', quantity: '', calories: 0, protein: 0, carbs: 0, fat: 0, baseMacros: null, searchResults: null, isSearching: false }]);
  const [createImageFile, setCreateImageFile] = useState(null);
  const [createImagePreview, setCreateImagePreview] = useState('');

  // Edit state
  const [isEditingRecipe, setIsEditingRecipe] = useState(false);
  const [editName, setEditName] = useState('');
  const [editInstructions, setEditInstructions] = useState('');
  const [editIngredients, setEditIngredients] = useState([]);
  const [editImageFile, setEditImageFile] = useState(null);
  const [editImagePreview, setEditImagePreview] = useState('');

  const apiSearchNutrients = async (query) => {
    const res = await fetch(`/recipes/search-nutrients?query=${encodeURIComponent(query)}`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    });
    if (res.status === 401) logout();
    if (!res.ok) throw new Error('No nutrient data found.');
    return res.json();
  };

  useEffect(() => {
    loadRecipes();
  }, []);

  const loadRecipes = async () => {
    setLoading(true);
    try {
      const data = await apiGetRecipes();
      setRecipes(data);
    } catch (err) {
      if (err.message === 'UNAUTHORIZED') logout();
      else showToast('Failed to load recipes.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const startNewRecipe = () => {
    setIsCreating(true);
    setIsEditingRecipe(false);
    setSelectedRecipe(null);
    setSelectedRecipeId(null);
    // Reset Form
    setName('');
    setInstructions('');
    setIngredients([{ name: '', quantity: '', calories: 0, protein: 0, carbs: 0, fat: 0, baseMacros: null, searchResults: null, isSearching: false }]);
    setCreateImageFile(null);
    setCreateImagePreview('');
  };

  const handleSelectRecipe = (r) => {
    setSelectedRecipe(r);
    setSelectedRecipeId(r.id || r._id);
    setIsCreating(false);
    setIsEditingRecipe(false);
    setEditImageFile(null);
    setEditImagePreview('');
  };

  const handleEditRecipe = () => {
    setEditName(selectedRecipe.name);
    setEditInstructions(selectedRecipe.instructions);
    setEditIngredients(selectedRecipe.ingredients && selectedRecipe.ingredients.length > 0 
      ? selectedRecipe.ingredients.map(ing => ({ 
          ...ing, 
          baseMacros: { 
            calories: (ing.calories / (parseFloat(ing.quantity) || 100)) * 100,
            protein: (ing.protein / (parseFloat(ing.quantity) || 100)) * 100,
            carbs: (ing.carbs / (parseFloat(ing.quantity) || 100)) * 100,
            fat: (ing.fat / (parseFloat(ing.quantity) || 100)) * 100
          },
          isSearching: false
        })) 
      : [{ name: '', quantity: '', calories: 0, protein: 0, carbs: 0, fat: 0, isSearching: false }]
    );
    setEditImageFile(null);
    setEditImagePreview(selectedRecipe.image_url || '');
    setIsEditingRecipe(true);
  };

  const removeEditIngredient = (index) => {
    setEditIngredients(prev => prev.filter((_, i) => i !== index));
  };

  const handleSaveEdit = async () => {
    if (!editName.trim()) {
      showToast('Enter a recipe name.', 'error');
      return;
    }

    if (!selectedRecipeId) {
      console.error('Recipe ID not found');
      showToast('Recipe ID not found. Please try again.', 'error');
      return;
    }

    try {
      let imageUrl = selectedRecipe.image_url || null;

      // Upload new image if selected
      if (editImageFile) {
        console.log('Uploading new image...');
        try {
          const uploadResult = await apiUploadRecipeImage(editImageFile);
          console.log('Upload result:', uploadResult);
          imageUrl = uploadResult.url;
        } catch (uploadErr) {
          console.error('Image upload failed:', uploadErr);
          showToast('Failed to upload image. Please try again.', 'error');
          return;
        }
      }

      const validIngredients = editIngredients
        .filter(ing => ing.name && ing.name.trim() !== '')
        .map(ing => ({
          name: ing.name.trim(),
          quantity: String(ing.quantity || 0),
          calories: parseFloat(ing.calories) || 0.0,
          protein: parseFloat(ing.protein) || 0.0,
          carbs: parseFloat(ing.carbs) || 0.0,
          fat: parseFloat(ing.fat) || 0.0
        }));

      // Ensure we have at least one ingredient
      if (validIngredients.length === 0) {
        showToast('Please add at least one ingredient.', 'error');
        return;
      }

      const updatedRecipe = {
        name: editName.trim(),
        instructions: editInstructions.trim(),
        ingredients: validIngredients,
        image_url: imageUrl
      };

      console.log('Sending update request:', {
        recipeId: selectedRecipeId,
        recipe: updatedRecipe
      });

      await apiUpdateRecipe(selectedRecipeId, updatedRecipe);
      showToast(`Recipe "${editName}" updated.`);
      setIsEditingRecipe(false);
      loadRecipes();
      setSelectedRecipe(null);
      setSelectedRecipeId(null);
      setEditImageFile(null);
      setEditImagePreview('');
    } catch (err) {
      console.error('Update Error:', err);
      console.error('Error details:', err.response?.data || err.message);
      showToast(err.message || 'Error updating recipe', 'error');
    }
  };

  const handleCancel = () => {
    setIsEditingRecipe(false);
    setIsCreating(false);
    if (!selectedRecipe) setSelectedRecipeId(null);
  };

  const handleDeleteRecipe = async (id, e) => {
    e.stopPropagation();
    if (!window.confirm('Delete this recipe?')) return;
    try {
      await apiDeleteRecipe(id);
      setRecipes((prev) => prev.filter((r) => (r.id || r._id) !== id));
      if (selectedRecipeId === id) {
        setSelectedRecipe(null);
        setSelectedRecipeId(null);
        setIsEditingRecipe(false);
      }
      showToast('Recipe deleted.');
    } catch (err) {
      if (err.message === 'UNAUTHORIZED') logout();
      else showToast(err.message || 'Failed to delete recipe.', 'error');
    }
  };

  const handleImageSelect = (event, isEdit = false) => {
    const file = event.target.files[0];
    if (file) {
      if (isEdit) {
        setEditImageFile(file);
        const reader = new FileReader();
        reader.onload = (e) => setEditImagePreview(e.target.result);
        reader.readAsDataURL(file);
      } else {
        setCreateImageFile(file);
        const reader = new FileReader();
        reader.onload = (e) => setCreateImagePreview(e.target.result);
        reader.readAsDataURL(file);
      }
    }
  };

  const calculateIngredientMacros = (ing) => {
    if (!ing.baseMacros || !ing.quantity) return ing;
    const factor = parseFloat(ing.quantity) / 100;
    return {
      ...ing,
      calories: (ing.baseMacros.calories * factor).toFixed(1),
      protein: (ing.baseMacros.protein * factor).toFixed(1),
      carbs: (ing.baseMacros.carbs * factor).toFixed(1),
      fat: (ing.baseMacros.fat * factor).toFixed(1)
    };
  };

  const executeSearch = async (index, isEdit = false) => {
    const list = isEdit ? editIngredients : ingredients;
    const query = list[index].name;
    
    if (!query || query.trim().length < 2) return;
    
    updateIngredientState(index, 'isSearching', true, isEdit);
    
    try {
      const data = await apiSearchNutrients(query.trim());
      let results = Array.isArray(data) ? data : [data];

      // Filter out items that have no macro data (all zeros) to avoid unusable results
      results = results.filter(item => 
        (parseFloat(item.calories) || 0) > 0 || 
        (parseFloat(item.protein) || 0) > 0 || 
        (parseFloat(item.carbs) || 0) > 0 || 
        (parseFloat(item.fat) || 0) > 0
      );

      if (results.length === 0) {
        showToast(`No nutritional data found for "${query.trim()}".`, 'error');
        const setList = isEdit ? setEditIngredients : setIngredients;
        setList(prev => prev.map((ing, i) => i === index ? { ...ing, isSearching: false, searchResults: null } : ing));
        return;
      }

      const setList = isEdit ? setEditIngredients : setIngredients;
      setList(prev => prev.map((ing, i) => i === index ? { ...ing, isSearching: false, searchResults: results } : ing));
    } catch (err) {
      showToast(err.message, 'error');
      const setList = isEdit ? setEditIngredients : setIngredients;
      setList(prev => prev.map((ing, i) => i === index ? { ...ing, isSearching: false, searchResults: null } : ing));
    }
  };

  const updateIngredientState = (index, field, value, isEdit) => {
    const setList = isEdit ? setEditIngredients : setIngredients;
    setList(prev => {
      const newList = [...prev];
      newList[index] = { ...newList[index], [field]: value };
      return newList.map((ing, i) => i === index ? calculateIngredientMacros(ing) : ing);
    });
  };

  const addEditIngredientField = () => {
    setEditIngredients([...editIngredients, { name: '', quantity: '', calories: 0, protein: 0, carbs: 0, fat: 0, isSearching: false }]);
  };

  const handleCreate = async () => {
    if (!name.trim()) { 
        showToast('Enter a recipe name.', 'error'); 
        return; 
    }
    
    try {
      let imageUrl = null;

      // Upload image if selected
      if (createImageFile) {
        try {
          const uploadResult = await apiUploadRecipeImage(createImageFile);
          imageUrl = uploadResult.url;
        } catch (uploadErr) {
          console.error('Image upload failed:', uploadErr);
          showToast('Failed to upload image. Please try again.', 'error');
          return;
        }
      }

      // Ensure name exists and quantity is a valid number
      const validIngredients = ingredients
          .filter(ing => ing.name.trim() !== '')
          .map(ing => ({
              name: ing.name.trim(),
              quantity: String(ing.quantity || 0), // Ensure quantity is always a string
              calories: parseFloat(ing.calories) || 0.0,
              protein: parseFloat(ing.protein) || 0.0,
              carbs: parseFloat(ing.carbs) || 0.0,
              fat: parseFloat(ing.fat) || 0.0
          }));
      
      const newRecipe = { 
        name: name.trim(), 
        instructions: instructions.trim(), 
        ingredients: validIngredients, 
        image_url: imageUrl 
      };
      
      await apiCreateRecipe(newRecipe);
      showToast(`Recipe "${name}" created.`);
      
      // Reset Form
      setName('');
      setInstructions('');
      setIngredients([{ name: '', quantity: '', calories: 0, protein: 0, carbs: 0, fat: 0, isSearching: false }]);
      setIsCreating(false);
      setCreateImageFile(null);
      setCreateImagePreview('');
      loadRecipes();
    } catch (err) {
        // This logs the ACTUAL error to the console so you can see if it's a 400 or 500 error
        console.error("Save Error:", err);
        showToast(err.message || 'Error saving recipe', 'error');
    }
  };

  const updateIngredient = (index, field, value) => {
    setIngredients(prev => {
      const newIngs = [...prev];
      newIngs[index] = { ...newIngs[index], [field]: value };
      // Clear results if name changes
      if (field === 'name') newIngs[index].searchResults = null;
      return newIngs.map((ing, i) => i === index ? calculateIngredientMacros(ing) : ing);
    });
  };

  const addIngredientField = () => {
    setIngredients([...ingredients, { name: '', quantity: '', calories: 0, protein: 0, carbs: 0, fat: 0, isSearching: false }]);
  };

  const removeIngredient = (index) => {
    setIngredients(prev => prev.filter((_, i) => i !== index));
  };

  const updateEditIngredient = (index, field, value) => {
    setEditIngredients(prev => {
      const newIngs = [...prev];
      newIngs[index] = { ...newIngs[index], [field]: value };
      // Clear results if name changes
      if (field === 'name') newIngs[index].searchResults = null;
      return newIngs.map((ing, i) => i === index ? calculateIngredientMacros(ing) : ing);
    });
  };

  return (
    <div className="recipes-layout" style={{ height: 'calc(100vh - 120px)' }}>
      
      {/* ── LEFT COLUMN: Recipe List ── */}
      <div className="recipes-list-column" style={{ display: 'flex', flexDirection: 'column' }}>
        <div className="sidebar-header">
          <h2>RECIPES</h2>
        </div>

        <div className="session-list" style={{ flex: 1, overflowY: 'auto' }}>
          {recipes.length === 0 ? (
            <div className="empty-state">
              <p>No recipes yet.<br />Add your first one above.</p>
            </div>
          ) : (
            recipes.map((r) => (
              <div 
                key={r.id || r._id} 
                className={`session-item ${selectedRecipeId === (r.id || r._id) ? 'selected' : ''}`}
                onClick={() => handleSelectRecipe(r)}
              >
                <div className="session-item-body">
                  <div className="s-name">{r.name}</div>
                  <div className="s-meta">{r.ingredients?.length || 0} Ingredients</div>
                </div>
                <button 
                  className="btn-danger del-btn"
                  onClick={(e) => handleDeleteRecipe(r.id || r._id, e)}
                >
                  DEL
                </button>
              </div>
            ))
          )}
        </div>
        <div style={{ padding: '15px', borderTop: '1px solid var(--border)' }}>
          <button className="btn btn-primary btn-full" onClick={startNewRecipe}>
            + CREATE NEW RECIPE
          </button>
        </div>
      </div>

      {/* ── RIGHT COLUMN: Recipe Details or Create Form ── */}
      <div className="session-detail">
        {isCreating ? (
          <div className="detail-content" style={{ padding: '20px', overflowY: 'auto', height: '100%' }}>
            <div className="detail-header" style={{ marginBottom: '30px', borderBottom: '1px solid var(--border)', paddingBottom: '20px' }}>
              <h1 className="session-title">NEW RECIPE</h1>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button className="btn btn-primary" onClick={handleCreate}>SAVE RECIPE</button>
                <button className="btn btn-ghost" onClick={handleCancel}>CANCEL</button>
              </div>
            </div>

            <div className="form-row">
              <label>Recipe Name</label>
              <input 
                type="text" 
                className="input-base"
                style={{ width: '100%', background: '#1a1a1a', border: '1px solid #333', color: 'white', padding: '12px' }}
                value={name} 
                placeholder="Chicken Parm, Smoothie..."
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            
            <div className="form-row" style={{ marginTop: '20px' }}>
              <label>Ingredients</label>
              <div style={{ marginBottom: '10px' }}>
                {ingredients.map((ing, i) => (
                  <div key={i} style={{ position: 'relative', marginBottom: '10px' }}>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <input 
                        type="text" 
                        placeholder="Ingredient" 
                        style={{ flex: '3', background: '#1a1a1a', border: '1px solid #333', color: 'white', padding: '8px' }}
                        value={ing.name} 
                        onChange={(e) => updateIngredient(i, 'name', e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            executeSearch(i, false);
                          }
                        }}
                      />
                      <input 
                        type="number" 
                        placeholder="Grams" 
                        style={{ flex: '1.2', background: '#1a1a1a', border: '1px solid #333', color: 'white', padding: '8px' }}
                        value={ing.quantity} 
                        onChange={(e) => updateIngredient(i, 'quantity', e.target.value)}
                      />
                      <button className="btn-remove-set" onClick={() => removeIngredient(i)}>✕</button>
                    </div>
                    {ing.isSearching && (
                      <div style={{ 
                        position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10,
                        background: '#222', border: '1px solid var(--border)', borderRadius: '4px',
                        padding: '10px', marginTop: '4px', fontSize: '0.75rem', boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                        color: 'var(--yellow)', textAlign: 'left', letterSpacing: '1px'
                      }}>
                        SEARCHING...
                      </div>
                    )}
                    {ing.searchResults && ing.searchResults.length > 0 && (
                      <div style={{ 
                        position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10,
                        background: '#222', border: '1px solid var(--border)', borderRadius: '4px',
                        padding: '5px', marginTop: '4px', fontSize: '0.8rem', boxShadow: '0 4px 12px rgba(0,0,0,0.5)'
                      }}>
                        <div style={{ color: '#888', fontSize: '10px', marginBottom: '5px', paddingLeft: '5px' }}>SUGGESTIONS:</div>
                        {ing.searchResults.slice(0, 3).map((result, idx) => (
                          <div key={idx} className="suggestion-item" style={{ padding: '8px', cursor: 'pointer', borderBottom: idx < 2 ? '1px solid #333' : 'none' }}
                            onClick={() => {
                              const newList = [...ingredients];
                              newList[i].name = result.name || ing.name;
                              newList[i].baseMacros = result;
                              newList[i].searchResults = null;
                              setIngredients(newList.map((it, itemIdx) => itemIdx === i ? calculateIngredientMacros(it) : it));
                            }}>
                            {result.name || ing.name} <span style={{ color: 'var(--green)', float: 'right' }}>SELECT</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <button className="btn-ghost btn-sm" onClick={addIngredientField}>+ ADD ITEM</button>
            </div>

            <div className="form-row" style={{ marginTop: '20px' }}>
              <label>Instructions</label>
              <textarea 
                className="input-base" 
                style={{ width: '100%', background: '#1a1a1a', border: '1px solid #333', color: 'white', padding: '12px', fontFamily: 'JetBrains Mono', minHeight: '120px' }}
                value={instructions} 
                onChange={(e) => setInstructions(e.target.value)}
                placeholder="Step by step directions..."
              />
            </div>

            <div className="form-row" style={{ marginTop: '20px' }}>
              <label>Recipe Image (optional)</label>
              <div style={{ marginBottom: '20px' }}>
                <div style={{ marginBottom: '10px' }}>
                  <label htmlFor="create-image-upload" className="btn btn-ghost" style={{ cursor: 'pointer', display: 'inline-block' }}>
                    CHOOSE IMAGE
                  </label>
                  <input
                    id="create-image-upload"
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleImageSelect(e, false)}
                    style={{ display: 'none' }}
                  />
                </div>
                {createImagePreview && (
                  <div style={{ 
                    background: 'var(--surface2)',
                    padding: '20px',
                    border: '1px solid var(--border)',
                    borderRadius: '4px',
                    textAlign: 'center'
                  }}>
                    <img 
                      src={createImagePreview} 
                      alt="Preview"
                      style={{ 
                        maxWidth: '100%', 
                        maxHeight: '300px',
                        borderRadius: '4px',
                        objectFit: 'contain'
                      }}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : selectedRecipe ? (
          <div className="detail-content">
            {!isEditingRecipe ? (
              <>
                {/* VIEW MODE */}
                <div className="detail-header">
                  <div>
                    <h1 className="session-title">{selectedRecipe.name}</h1>
                    <span className="session-date-badge">RECIPE CARD</span>
                  </div>
                  <button className="btn btn-primary" onClick={handleEditRecipe}>
                    EDIT
                  </button>
                </div>

                <section className="exercises-section">
                  <h3>MACROS</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
                    <div style={{ 
                      background: 'var(--surface2)', 
                      border: '1px solid var(--border)', 
                      padding: '16px', 
                      borderRadius: '4px',
                      textAlign: 'center'
                    }}>
                      <div style={{ fontSize: '12px', color: '#888', textTransform: 'uppercase', marginBottom: '8px' }}>Calories</div>
                      <div style={{ fontSize: '24px', fontWeight: '600', color: '#e8e8e8' }}>{selectedRecipe.calories_per_serving.toFixed(1)}</div>
                    </div>
                    <div style={{ 
                      background: 'var(--surface2)', 
                      border: '1px solid var(--border)', 
                      padding: '16px', 
                      borderRadius: '4px',
                      textAlign: 'center'
                    }}>
                      <div style={{ fontSize: '12px', color: '#888', textTransform: 'uppercase', marginBottom: '8px' }}>Protein (g)</div>
                      <div style={{ fontSize: '24px', fontWeight: '600', color: '#e8e8e8' }}>{selectedRecipe.protein_per_serving.toFixed(1)}</div>
                    </div>
                    <div style={{ 
                      background: 'var(--surface2)', 
                      border: '1px solid var(--border)', 
                      padding: '16px', 
                      borderRadius: '4px',
                      textAlign: 'center'
                    }}>
                      <div style={{ fontSize: '12px', color: '#888', textTransform: 'uppercase', marginBottom: '8px' }}>Carbs (g)</div>
                      <div style={{ fontSize: '24px', fontWeight: '600', color: '#e8e8e8' }}>{selectedRecipe.carbs_per_serving.toFixed(1)}</div>
                    </div>
                    <div style={{ 
                      background: 'var(--surface2)', 
                      border: '1px solid var(--border)', 
                      padding: '16px', 
                      borderRadius: '4px',
                      textAlign: 'center'
                    }}>
                      <div style={{ fontSize: '12px', color: '#888', textTransform: 'uppercase', marginBottom: '8px' }}>Fat (g)</div>
                      <div style={{ fontSize: '24px', fontWeight: '600', color: '#e8e8e8' }}>{selectedRecipe.fat_per_serving.toFixed(1)}</div>
                    </div>
                  </div>
                </section>

                <hr style={{ border: 'none', borderTop: '1px solid #444', margin: '20px 0' }} />

                <section className="exercises-section">
                  <h3>INGREDIENTS</h3>
                  <div className="exercise-card">
                    <table className="sets-table">
                      <thead>
                        <tr>
                          <th>ITEM</th>
                          <th>WEIGHT</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedRecipe.ingredients?.map((ing, i) => (
                          <tr key={i}>
                            <td className="set-num">{ing.name}</td>
                            <td className="set-1rm">{ing.quantity}g</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>

                <section className="add-exercise-section">
                  <h3>INSTRUCTIONS</h3>
                  <div style={{ 
                    fontFamily: 'JetBrains Mono', 
                    lineHeight: '1.6', 
                    color: '#e8e8e8',
                    whiteSpace: 'pre-wrap',
                    background: 'var(--surface2)',
                    padding: '20px',
                    border: '1px solid var(--border)'
                  }}>
                    {selectedRecipe.instructions || "No instructions provided."}
                  </div>
                </section>

                {selectedRecipe.image_url && (
                  <section className="add-exercise-section">
                    <div style={{ 
                      background: 'var(--surface2)',
                      padding: '20px',
                      border: '1px solid var(--border)',
                      borderRadius: '4px',
                      textAlign: 'center'
                    }}>
                      <img 
                        src={selectedRecipe.image_url} 
                        alt={selectedRecipe.name}
                        style={{ 
                          maxWidth: '100%', 
                          maxHeight: '400px',
                          borderRadius: '4px',
                          objectFit: 'contain'
                        }}
                      />
                    </div>
                  </section>
                )}
              </>
            ) : (
              <>
                {/* EDIT MODE */}
                <div className="detail-header">
                  <div>
                    <h1 className="session-title">EDIT RECIPE</h1>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
                  <button className="btn btn-primary" onClick={handleSaveEdit}>
                    SAVE CHANGES
                  </button>
                  <button className="btn btn-ghost" onClick={handleCancel}>
                    CANCEL
                  </button>
                </div>

                <section className="exercises-section">
                  <h3>RECIPE NAME</h3>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '12px',
                      background: '#1a1a1a',
                      border: '2px solid #2a2a2a',
                      color: 'white',
                      fontFamily: 'JetBrains Mono',
                      marginBottom: '20px'
                    }}
                  />
                </section>

                <section className="exercises-section">
                  <h3>INGREDIENTS</h3>
                  {editIngredients.map((ing, i) => (
                    <div key={i} style={{ position: 'relative', marginBottom: '10px' }}>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <input
                          type="text"
                          placeholder="Ingredient"
                          style={{ flex: '2.5', padding: '8px', background: '#1a1a1a', border: '2px solid #2a2a2a', color: 'white' }}
                          value={ing.name}
                          onChange={(e) => updateEditIngredient(i, 'name', e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              executeSearch(i, true);
                            }
                          }}
                        />
                        <input
                          type="number"
                          placeholder="Grams"
                          style={{ flex: '1.2', padding: '8px', background: '#1a1a1a', border: '2px solid #2a2a2a', color: 'white' }}
                          value={ing.quantity}
                          onChange={(e) => updateEditIngredient(i, 'quantity', e.target.value)}
                        />
                        <button className="btn-remove-set" onClick={() => removeEditIngredient(i)}>✕</button>
                      </div>
                      {ing.isSearching && (
                        <div style={{ 
                          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100,
                          background: '#222', border: '1px solid var(--border)', borderRadius: '4px',
                          padding: '10px', marginTop: '4px', fontSize: '0.75rem', boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                          color: 'var(--yellow)', textAlign: 'left', letterSpacing: '1px'
                        }}>
                          SEARCHING...
                        </div>
                      )}
                      {ing.searchResults && ing.searchResults.length > 0 && (
                        <div style={{ 
                          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100,
                          background: '#222', border: '1px solid var(--border)', borderRadius: '4px',
                          padding: '5px', marginTop: '4px', fontSize: '0.8rem', boxShadow: '0 4px 12px rgba(0,0,0,0.5)'
                        }}>
                          <div style={{ color: '#888', fontSize: '10px', marginBottom: '5px', paddingLeft: '5px' }}>SUGGESTIONS:</div>
                          {ing.searchResults.slice(0, 3).map((result, idx) => (
                              <div 
                                  key={idx}
                                  className="suggestion-item"
                                  style={{ padding: '8px', cursor: 'pointer', borderBottom: idx < 2 ? '1px solid #333' : 'none' }}
                                  onClick={() => {
                                      const newList = [...editIngredients];
                                      newList[i].name = result.name || ing.name;
                                      newList[i].baseMacros = result;
                                      newList[i].searchResults = null;
                                      setEditIngredients(newList.map((it, itemIdx) => itemIdx === i ? calculateIngredientMacros(it) : it));
                                  }}
                              >
                                  {result.name || ing.name} <span style={{ color: 'var(--green)', float: 'right' }}>SELECT</span>
                              </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                  <button className="btn-ghost btn-sm" onClick={addEditIngredientField} style={{ marginBottom: '20px' }}>
                    + ADD ITEM
                  </button>
                </section>

                <section className="exercises-section">
                  <h3>INSTRUCTIONS</h3>
                  <textarea
                    value={editInstructions}
                    onChange={(e) => setEditInstructions(e.target.value)}
                    style={{
                      width: '100%',
                      background: '#1a1a1a',
                      border: '2px solid #2a2a2a',
                      color: 'white',
                      padding: '12px',
                      fontFamily: 'JetBrains Mono',
                      minHeight: '100px',
                      resize: 'vertical'
                    }}
                  />
                </section>

                <section className="exercises-section">
                  <h3>RECIPE IMAGE</h3>
                  <div style={{ marginBottom: '20px' }}>
                    <div style={{ marginBottom: '10px' }}>
                      <label 
                        htmlFor="edit-image-upload" 
                        className="btn btn-ghost"
                        style={{ cursor: 'pointer', display: 'inline-block' }}
                      >
                        CHOOSE IMAGE
                      </label>
                      <input
                        id="edit-image-upload"
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleImageSelect(e, true)}
                        style={{ display: 'none' }}
                      />
                    </div>
                    {editImagePreview && (
                      <div style={{ 
                        background: 'var(--surface2)',
                        padding: '20px',
                        border: '1px solid var(--border)',
                        borderRadius: '4px',
                        textAlign: 'center'
                      }}>
                        <img 
                          src={editImagePreview} 
                          alt="Preview"
                          style={{ 
                            maxWidth: '100%', 
                            maxHeight: '300px',
                            borderRadius: '4px',
                            objectFit: 'contain'
                          }}
                        />
                      </div>
                    )}
                  </div>
                </section>
              </>
            )}
          </div>
        ) : (
          <div className="detail-placeholder">
            <p>Select a recipe from the sidebar<br />or create a new one.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default RecipeLibrary;