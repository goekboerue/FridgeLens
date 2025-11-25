import React, { useState, useRef, useEffect } from 'react';
import { AppState, Ingredient, Recipe, DIETARY_OPTIONS } from './types';
import { analyzeFridgeImage, generateRecipesFromIngredients } from './services/geminiService';
import { MarketIntegration } from './components/MarketIntegration';

const Signature = () => (
  <div className="w-full py-6 flex justify-center items-center mt-auto pointer-events-none opacity-90">
    <p className="text-sm font-medium text-slate-900 tracking-wide">
      Geliştirici : <span className="text-emerald-600 font-bold ml-1">Cafer Ahmet Koç</span>
    </p>
  </div>
);

const RecipePlaceholder = ({ className, large = false }: { className?: string, large?: boolean }) => (
  <div className={`flex items-center justify-center bg-gradient-to-br from-emerald-50 to-orange-50 border-b border-emerald-100/50 ${className}`}>
    <div className={`relative flex items-center justify-center rounded-full bg-white/40 backdrop-blur-sm ${large ? 'p-8' : 'p-4'}`}>
      <svg 
        xmlns="http://www.w3.org/2000/svg" 
        viewBox="0 0 24 24" 
        fill="none" 
        stroke="currentColor" 
        strokeWidth="1" 
        strokeLinecap="round" 
        strokeLinejoin="round" 
        className={`${large ? 'w-24 h-24' : 'w-12 h-12'} text-emerald-700/60`}
      >
        <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2" />
        <path d="M7 2v20" />
        <path d="M21 15V2v0a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7" />
      </svg>
    </div>
  </div>
);

// Helper to wrap text on canvas
const wrapText = (ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number) => {
  const words = text.split(' ');
  let line = '';
  let currentY = y;

  for (let n = 0; n < words.length; n++) {
    const testLine = line + words[n] + ' ';
    const metrics = ctx.measureText(testLine);
    const testWidth = metrics.width;
    if (testWidth > maxWidth && n > 0) {
      ctx.fillText(line, x, currentY);
      line = words[n] + ' ';
      currentY += lineHeight;
    } else {
      line = testLine;
    }
  }
  ctx.fillText(line, x, currentY);
  return currentY + lineHeight;
};

// Generate a shareable recipe card image
const generateRecipeCard = async (recipe: Recipe): Promise<File | null> => {
  const canvas = document.createElement('canvas');
  const width = 800;
  const height = 1200;
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  // Background Gradient
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, '#ecfdf5'); // emerald-50
  gradient.addColorStop(1, '#ffffff');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  // Header Bar
  ctx.fillStyle = '#059669'; // emerald-600
  ctx.fillRect(0, 0, width, 120);

  // Header Text
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 48px Inter, system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('FridgeLens', width / 2, 60);

  // Content Container (Shadow Effect)
  ctx.shadowColor = 'rgba(0, 0, 0, 0.1)';
  ctx.shadowBlur = 30;
  ctx.shadowOffsetY = 10;
  ctx.fillStyle = '#ffffff';
  ctx.roundRect(50, 160, width - 100, height - 250, 30);
  ctx.fill();
  ctx.shadowColor = 'transparent';

  // Recipe Title
  ctx.fillStyle = '#0f172a'; // slate-900
  ctx.font = 'bold 56px Inter, system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  let nextY = wrapText(ctx, recipe.title, width / 2, 220, 600, 70);

  // Separator
  ctx.beginPath();
  ctx.moveTo(200, nextY + 20);
  ctx.lineTo(600, nextY + 20);
  ctx.strokeStyle = '#e2e8f0'; // slate-200
  ctx.lineWidth = 2;
  ctx.stroke();

  // Stats
  nextY += 60;
  ctx.fillStyle = '#64748b'; // slate-500
  ctx.font = 'medium 28px Inter, system-ui, sans-serif';
  const stats = `${recipe.prepTime}  •  ${recipe.difficulty}  •  ${recipe.calories} kcal`;
  ctx.fillText(stats, width / 2, nextY);

  // Ingredients Section
  nextY += 80;
  ctx.textAlign = 'left';
  ctx.fillStyle = '#059669'; // emerald-600
  ctx.font = 'bold 36px Inter, system-ui, sans-serif';
  ctx.fillText('Malzemeler', 100, nextY);

  nextY += 50;
  ctx.fillStyle = '#334155'; // slate-700
  ctx.font = '28px Inter, system-ui, sans-serif';
  
  // List first 8 used ingredients
  recipe.usedIngredients.slice(0, 8).forEach(ing => {
    ctx.fillText(`• ${ing}`, 100, nextY);
    nextY += 45;
  });

  // List missing ingredients if any
  if (recipe.missingIngredients.length > 0) {
    recipe.missingIngredients.slice(0, 3).forEach(ing => {
      ctx.fillStyle = '#ea580c'; // orange-600
      ctx.fillText(`• ${ing} (Eksik)`, 100, nextY);
      nextY += 45;
    });
    ctx.fillStyle = '#334155';
  }

  // Footer / Branding
  const footerY = height - 60;
  ctx.textAlign = 'center';
  ctx.fillStyle = '#059669';
  ctx.font = 'italic 24px Inter, system-ui, sans-serif';
  ctx.fillText('Yapay Zeka Destekli Atıksız Mutfak', width / 2, footerY);

  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(new File([blob], `fridgelens-${recipe.id}.png`, { type: 'image/png' }));
      } else {
        resolve(null);
      }
    }, 'image/png');
  });
};


const App = () => {
  // State
  const [appState, setAppState] = useState<AppState>(AppState.HOME);
  const [image, setImage] = useState<string | null>(null);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSharing, setIsSharing] = useState(false);
  
  // Preferences State
  const [dietaryPreference, setDietaryPreference] = useState<string>('Hepsi');
  const [allergies, setAllergies] = useState<string>('');

  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);

  // Handlers
  const handleStart = () => {
    setAppState(AppState.CAMERA);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImage(reader.result as string);
        processImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const startCamera = async () => {
    setIsCameraOpen(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } 
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch (err) {
      console.error("Camera error:", err);
      setError("Kameraya erişilemedi. Lütfen dosya yüklemeyi deneyin.");
      setIsCameraOpen(false);
    }
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const context = canvasRef.current.getContext('2d');
      if (context) {
        canvasRef.current.width = videoRef.current.videoWidth;
        canvasRef.current.height = videoRef.current.videoHeight;
        context.drawImage(videoRef.current, 0, 0);
        const dataUrl = canvasRef.current.toDataURL('image/jpeg');
        
        // Stop stream
        const stream = videoRef.current.srcObject as MediaStream;
        stream?.getTracks().forEach(track => track.stop());
        
        setIsCameraOpen(false);
        setImage(dataUrl);
        processImage(dataUrl);
      }
    }
  };

  const processImage = async (imgData: string) => {
    setAppState(AppState.ANALYZING);
    setError(null);
    try {
      const foundIngredientNames = await analyzeFridgeImage(imgData);
      // Map strings to Ingredient objects
      const ingredientObjects: Ingredient[] = foundIngredientNames.map(name => ({
        name,
        expiryDate: undefined
      }));
      setIngredients(ingredientObjects);
      setAppState(AppState.INGREDIENTS);
    } catch (err: any) {
      setError(err.message || "Bir hata oluştu.");
      setAppState(AppState.HOME); // Reset on critical error
    }
  };

  const handleGenerateRecipes = async () => {
    setAppState(AppState.GENERATING_RECIPES);
    try {
      const generatedRecipes = await generateRecipesFromIngredients(
        ingredients,
        dietaryPreference,
        allergies
      );
      setRecipes(generatedRecipes);
      setAppState(AppState.RECIPES);
    } catch (err: any) {
      setError(err.message || "Tarif oluşturulamadı.");
      setAppState(AppState.INGREDIENTS);
    }
  };

  const removeIngredient = (index: number) => {
    const newIngredients = [...ingredients];
    newIngredients.splice(index, 1);
    setIngredients(newIngredients);
  };

  const updateExpiryDate = (index: number, date: string) => {
    const newIngredients = [...ingredients];
    newIngredients[index].expiryDate = date;
    setIngredients(newIngredients);
  };

  const handleShare = async (recipe: Recipe) => {
    setIsSharing(true);
    try {
      const file = await generateRecipeCard(recipe);
      if (!file) throw new Error("Görsel oluşturulamadı");

      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: recipe.title,
          text: `FridgeLens ile bulduğum harika bir tarif: ${recipe.title}`
        });
      } else {
        // Fallback for desktop/unsupported: Download
        const url = URL.createObjectURL(file);
        const a = document.createElement('a');
        a.href = url;
        a.download = `fridgelens-${recipe.id}.png`;
        a.click();
        URL.revokeObjectURL(url);
        setError("Paylaşım desteklenmiyor, görsel indirildi.");
      }
    } catch (err) {
      console.error(err);
      setError("Paylaşım sırasında bir hata oluştu.");
    } finally {
      setIsSharing(false);
    }
  };

  const getUrgencyLevel = (dateStr?: string) => {
    if (!dateStr) return 'none';
    const today = new Date();
    today.setHours(0,0,0,0);
    const date = new Date(dateStr);
    const diffTime = date.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) return 'expired';
    if (diffDays <= 3) return 'critical';
    if (diffDays <= 7) return 'warning';
    return 'good';
  };

  // Render Helpers
  const renderHome = () => (
    <div className="flex flex-col items-center justify-center min-h-screen p-6 bg-gradient-to-br from-emerald-50 to-teal-100 text-center relative">
      <div className="flex-1 flex flex-col items-center justify-center w-full">
        <div className="bg-white p-4 rounded-full shadow-lg mb-6 animate-bounce">
          <span className="text-6xl">🥗</span>
        </div>
        <h1 className="text-4xl font-bold text-emerald-900 mb-2 tracking-tight">FridgeLens</h1>
        <p className="text-lg text-emerald-700 mb-8 max-w-xs">
          Buzdolabının fotoğrafını çek, atıksız ve lezzetli tarifler anında cebine gelsin.
        </p>
        <button 
          onClick={handleStart}
          className="w-full max-w-sm bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-4 px-8 rounded-2xl shadow-xl transition-all transform hover:scale-105 flex items-center justify-center gap-3"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
          </svg>
          Mutfak Keşfine Başla
        </button>
      </div>
      <Signature />
    </div>
  );

  const renderCamera = () => (
    <div className="flex flex-col min-h-screen bg-black">
      <div className="flex-1 relative flex items-center justify-center overflow-hidden">
        {isCameraOpen ? (
          <video ref={videoRef} className="w-full h-full object-cover" autoPlay playsInline muted />
        ) : (
          <div className="text-white text-center p-6">
            <p className="mb-4">Kamerayı başlatın veya galeri seçin</p>
          </div>
        )}
        <canvas ref={canvasRef} className="hidden" />
      </div>
      
      <div className="bg-slate-900 p-8 pb-12 rounded-t-3xl flex justify-around items-center">
        <input 
          type="file" 
          accept="image/*" 
          ref={fileInputRef} 
          onChange={handleFileUpload} 
          className="hidden" 
        />
        <button 
          onClick={() => fileInputRef.current?.click()}
          className="p-4 rounded-full bg-slate-800 text-white hover:bg-slate-700 transition"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
          </svg>
        </button>
        
        {isCameraOpen ? (
          <button 
            onClick={capturePhoto}
            className="w-20 h-20 rounded-full border-4 border-white flex items-center justify-center"
          >
            <div className="w-16 h-16 bg-white rounded-full"></div>
          </button>
        ) : (
          <button 
            onClick={startCamera}
            className="w-20 h-20 rounded-full bg-emerald-500 flex items-center justify-center text-white shadow-lg shadow-emerald-500/50"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-10 h-10">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );

  const renderLoading = (text: string) => (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 p-6">
      <div className="w-16 h-16 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin mb-6"></div>
      <h2 className="text-xl font-bold text-slate-800 animate-pulse">{text}</h2>
      <p className="text-slate-500 mt-2 text-sm text-center">Yapay zeka buzdolabını inceliyor...</p>
    </div>
  );

  const renderIngredients = () => (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <div className="p-6 bg-white shadow-sm sticky top-0 z-10">
        <h2 className="text-2xl font-bold text-slate-800">Bulunan Malzemeler</h2>
        <p className="text-slate-500 text-sm">Son kullanma tarihlerini ekleyin, israfı önleyin.</p>
      </div>
      
      <div className="flex-1 p-6 pb-40">
        {image && (
          <div className="mb-6 rounded-xl overflow-hidden shadow-md h-32">
            <img src={image} alt="Buzdolabı" className="w-full h-full object-cover" />
          </div>
        )}
        
        <div className="space-y-3">
          {ingredients.map((ing, idx) => {
            const urgency = getUrgencyLevel(ing.expiryDate);
            let borderClass = "border-slate-200";
            let iconColor = "text-slate-400";
            
            if (urgency === 'critical') {
              borderClass = "border-red-300 bg-red-50";
              iconColor = "text-red-500";
            } else if (urgency === 'warning') {
              borderClass = "border-orange-300 bg-orange-50";
              iconColor = "text-orange-500";
            } else if (urgency === 'expired') {
               borderClass = "border-gray-300 bg-gray-100 opacity-70";
               iconColor = "text-gray-500";
            } else if (urgency === 'good') {
               borderClass = "border-emerald-200 bg-emerald-50";
               iconColor = "text-emerald-500";
            }

            return (
              <div key={idx} className={`bg-white border rounded-xl p-3 flex items-center justify-between shadow-sm transition-all ${borderClass}`}>
                <div className="flex-1">
                  <div className="font-semibold text-slate-800">{ing.name}</div>
                  <div className="flex items-center gap-2 mt-1">
                    <input 
                      type="date" 
                      value={ing.expiryDate || ''}
                      onChange={(e) => updateExpiryDate(idx, e.target.value)}
                      className="text-xs bg-transparent border-b border-slate-300 focus:border-emerald-500 outline-none text-slate-600 pb-0.5"
                    />
                    {urgency === 'critical' && <span className="text-[10px] font-bold text-red-600">Acil Tüket!</span>}
                    {urgency === 'expired' && <span className="text-[10px] font-bold text-gray-600">Süresi Dolmuş</span>}
                  </div>
                </div>
                
                <button onClick={() => removeIngredient(idx)} className="p-2 text-slate-400 hover:text-red-500 transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                    <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                  </svg>
                </button>
              </div>
            );
          })}
          {ingredients.length === 0 && (
             <div className="text-center w-full py-10 text-slate-400">Hiç malzeme bulunamadı.</div>
          )}
        </div>
        <Signature />
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-slate-200 shadow-[0_-5px_20px_-5px_rgba(0,0,0,0.1)] rounded-t-3xl z-20 max-w-md mx-auto">
        <div className="mb-4">
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2 mb-2">
            {DIETARY_OPTIONS.map(opt => (
              <button
                key={opt}
                onClick={() => setDietaryPreference(opt)}
                className={`whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                  dietaryPreference === opt 
                    ? 'bg-emerald-600 text-white border-emerald-600' 
                    : 'bg-white text-slate-600 border-slate-200 hover:border-emerald-400'
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
          <input 
            type="text" 
            placeholder="Alerjiler (örn: Fıstık, Süt...)" 
            value={allergies}
            onChange={(e) => setAllergies(e.target.value)}
            className="w-full text-sm p-3 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
          />
        </div>

        <button 
          onClick={handleGenerateRecipes}
          disabled={ingredients.length === 0}
          className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white font-bold py-3.5 rounded-xl shadow-lg transition-colors flex justify-center items-center gap-2"
        >
          <span>Lezzetli Tarifler Oluştur</span>
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
          </svg>
        </button>
      </div>
    </div>
  );

  const renderRecipeList = () => (
    <div className="min-h-screen bg-slate-50 pb-8 flex flex-col">
      <div className="bg-emerald-600 text-white p-6 rounded-b-3xl shadow-lg mb-6 sticky top-0 z-10">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold">Senin İçin Seçildi</h2>
          <button onClick={() => setAppState(AppState.INGREDIENTS)} className="text-emerald-100 hover:text-white text-sm bg-emerald-700/50 px-3 py-1 rounded-lg backdrop-blur-sm">
            Düzenle
          </button>
        </div>
        <p className="text-emerald-100 opacity-90 text-sm">
          {dietaryPreference !== 'Hepsi' && <span className="font-bold">{dietaryPreference} • </span>}
          {ingredients.length} malzeme ile atıksız tarifler.
        </p>
      </div>

      <div className="px-6 space-y-6 flex-1">
        {recipes.map((recipe) => (
          <div 
            key={recipe.id} 
            onClick={() => setSelectedRecipe(recipe)}
            className="bg-white rounded-2xl shadow-sm hover:shadow-md transition-shadow overflow-hidden cursor-pointer border border-slate-100"
          >
            <RecipePlaceholder className="h-32 w-full" />
            <div className="p-4 relative">
              <div className="absolute top-0 right-4 -mt-4 bg-white shadow-sm border border-slate-100 text-[10px] font-bold px-2 py-1 rounded-full text-slate-700 uppercase tracking-wide">
                 {recipe.difficulty}
              </div>
              <div className="flex justify-between items-start mb-2">
                <h3 className="font-bold text-lg text-slate-800 leading-tight flex-1">{recipe.title}</h3>
                <span className="text-xs text-slate-500 flex items-center gap-1 bg-slate-100 px-2 py-1 rounded-full whitespace-nowrap ml-2">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm.75-13a.75.75 0 00-1.5 0v5c0 .414.336.75.75.75l4 4a.75.75 0 101.06-1.06l-3.25-3.25V5.75z" clipRule="evenodd" />
                  </svg>
                  {recipe.prepTime}
                </span>
              </div>
              <p className="text-slate-600 text-sm line-clamp-2 mb-3">{recipe.description}</p>
              
              <div className="flex gap-2 text-xs flex-wrap">
                {recipe.missingIngredients.length > 0 ? (
                  <span className="text-orange-600 bg-orange-50 px-2 py-1 rounded-md font-medium">
                    {recipe.missingIngredients.length} eksik
                  </span>
                ) : (
                   <span className="text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md font-medium">
                    Tamam!
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
        {recipes.length === 0 && (
          <div className="text-center p-8 text-slate-500">
            Kriterlere uygun tarif bulunamadı. <br/>Lütfen filtreleri değiştirin.
          </div>
        )}
      </div>
      <Signature />
    </div>
  );

  const renderRecipeDetail = () => {
    if (!selectedRecipe) return null;

    return (
      <div className="fixed inset-0 bg-white z-50 overflow-y-auto animate-in slide-in-from-bottom-10 duration-300">
        <div className="relative h-64">
          <RecipePlaceholder className="w-full h-full" large />
          <div className="absolute top-4 left-4 right-4 flex justify-between items-center">
            <button 
              onClick={() => setSelectedRecipe(null)}
              className="bg-white/50 backdrop-blur-md p-2 rounded-full hover:bg-white transition-colors text-slate-900"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
              </svg>
            </button>
            <button 
              onClick={() => handleShare(selectedRecipe)}
              disabled={isSharing}
              className="bg-white/50 backdrop-blur-md p-2 rounded-full hover:bg-white transition-colors text-emerald-800 flex items-center gap-1 px-4 disabled:opacity-50"
            >
              {isSharing ? (
                <span className="text-xs font-bold">Hazırlanıyor...</span>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                    <path fillRule="evenodd" d="M15.75 4.5a3 3 0 11.825 2.066l-8.421 4.679a3.002 3.002 0 010 1.51l8.421 4.679a3 3 0 11-.729 1.31l-8.421-4.678a3 3 0 110-4.132l8.421-4.679a3 3 0 01-.096-.755z" clipRule="evenodd" />
                  </svg>
                  <span className="text-sm font-bold">Paylaş</span>
                </>
              )}
            </button>
          </div>
        </div>

        <div className="p-6 -mt-6 bg-white rounded-t-3xl relative min-h-screen flex flex-col">
          <div className="w-12 h-1 bg-slate-200 rounded-full mx-auto mb-6"></div>
          
          <h1 className="text-3xl font-bold text-slate-900 mb-2">{selectedRecipe.title}</h1>
          <div className="flex gap-4 text-sm text-slate-500 mb-6 border-b border-slate-100 pb-4">
             <span className="flex items-center gap-1">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {selectedRecipe.prepTime}
             </span>
             <span className="flex items-center gap-1">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
                </svg>
                {selectedRecipe.calories} kcal
             </span>
             <span className="flex items-center gap-1">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
                </svg>
                {selectedRecipe.difficulty}
             </span>
          </div>

          <p className="text-slate-600 mb-6">{selectedRecipe.description}</p>

          <MarketIntegration missingIngredients={selectedRecipe.missingIngredients} />

          <h3 className="font-bold text-lg text-slate-900 mt-6 mb-3">Malzemeler</h3>
          <ul className="space-y-2 mb-8">
            {selectedRecipe.usedIngredients.map((ing, i) => (
              <li key={i} className="flex items-center gap-3 text-slate-700">
                <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                {ing}
              </li>
            ))}
            {selectedRecipe.missingIngredients.map((ing, i) => (
              <li key={`missing-${i}`} className="flex items-center gap-3 text-slate-400 decoration-slate-300">
                 <div className="w-2 h-2 rounded-full bg-orange-300"></div>
                 {ing} (Eksik)
              </li>
            ))}
          </ul>

          <h3 className="font-bold text-lg text-slate-900 mb-3">Hazırlanışı</h3>
          <ol className="space-y-6">
            {selectedRecipe.instructions.map((step, i) => (
              <li key={i} className="flex gap-4">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center font-bold text-sm">
                  {i + 1}
                </div>
                <p className="text-slate-700 pt-1 leading-relaxed">{step}</p>
              </li>
            ))}
          </ol>
          
          <div className="flex-1"></div>
          <Signature />
          <div className="h-10"></div> {/* Bottom spacer */}
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-md mx-auto bg-white min-h-screen shadow-2xl relative overflow-hidden">
      {/* Error Toast */}
      {error && (
        <div className="absolute top-6 left-6 right-6 z-50 bg-red-50 text-red-700 px-4 py-3 rounded-xl shadow-lg border border-red-100 flex items-center gap-3 animate-in fade-in slide-in-from-top-4">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 flex-shrink-0">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
          </svg>
          <span className="text-sm font-medium">{error}</span>
          <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-900">
             ✕
          </button>
        </div>
      )}

      {appState === AppState.HOME && renderHome()}
      {appState === AppState.CAMERA && renderCamera()}
      {appState === AppState.ANALYZING && renderLoading("Malzemeler Taranıyor")}
      {appState === AppState.INGREDIENTS && renderIngredients()}
      {appState === AppState.GENERATING_RECIPES && renderLoading("Şef Düşünüyor")}
      {appState === AppState.RECIPES && renderRecipeList()}
      {selectedRecipe && renderRecipeDetail()}
    </div>
  );
};

export default App;