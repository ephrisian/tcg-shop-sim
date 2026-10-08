import React, { useState, useEffect, useMemo } from 'react';
import { 
  Search, Filter, Plus, Minus, Trash2, Edit, Check, Upload, RefreshCw, 
  Eye, Sparkles, FolderPlus, Layers, ExternalLink, ShieldCheck, 
  X, Info, Tag, CheckSquare, Square, Image as ImageIcon, Loader2,
  ChevronDown, Database, Copy, Globe, Settings, AlertTriangle, CheckCircle2
} from 'lucide-react';

const DEFAULT_COMPANIES = ['Kakawow', 'Card.Fun', 'Topps', 'Demon Card', 'Kayou', 'Bandai'];
const DEFAULT_CATEGORIES = ['Disney', 'Star Wars', 'Marvel', 'Sailor Moon', 'Tom & Jerry', 'Anime', 'TCG'];
const DEFAULT_TYPES = ['CR', 'FSP', 'GP', 'SSR', 'SR', 'AP', 'UR', 'PR', 'Base'];
const DEFAULT_RARITIES = ['Base', 'Rare', 'Refractive', 'Numbered', 'Parallel', 'Redemption', 'Promo'];
const DEFAULT_CARD_CATEGORIES = ['Living Space Card', 'Flowering Card', 'Poster Series', 'Character Card', 'Action Card', 'Standard Card'];

const TRANSLATION_MAP = [
  [/基础折射系列/g, 'Base Refractor Series'],
  [/怀旧故事卡/g, 'Nostalgic Story Card'],
  [/红桃审判卡/g, 'Red Heart Trial Card'],
  [/茶杯漂流卡/g, 'Teacup Drift Card'],
  [/仙境地图卡/g, 'Wonderland Map Card'],
  [/烟雾字母卡/g, 'Smoke Letter Card'],
  [/花朵音乐会/g, 'Flower Concert Card'],
  [/道具光栅卡/g, 'Prop Grating Card'],
  [/非生日派对/g, 'Unbirthday Party Card'],
  [/角色塔罗卡/g, 'Character Tarot Card'],
  [/奇遇幻想卡/g, 'Adventure Fantasy Card'],
  [/孔中世界卡/g, 'World in a Hole Card'],
  [/时钟混沌卡/g, 'Clock Chaos Card'],
  [/清醒梦境卡/g, 'Lucid Dream Card'],
  [/万花绚烂卡/g, 'Kaleidoscope Card'],
  [/秘密花园卡/g, 'Secret Garden Card'],
  [/梦境特典卡/g, 'Dream Special Card'],
  [/躲猫猫pr卡/g, 'Peek-a-boo PR Card'],
  [/基础/g, 'Base'],
  [/折射/g, 'Refractor'],
  [/系列/g, 'Series'],
  [/特卡/g, 'Special Card'],
  [/签名/g, 'Autograph'],
  [/编号/g, 'Numbered'],
  [/卡/g, 'Card'],
  [/限量/g, 'Limited'],
  [/金卡/g, 'Gold Card'],
  [/银卡/g, 'Silver Card'],
];

const translateText = (text) => {
  if (!text) return '';
  let cleanText = text;
  TRANSLATION_MAP.forEach(([regex, replacement]) => {
    cleanText = cleanText.replace(regex, replacement);
  });
  cleanText = cleanText.replace(/\s+/g, ' ').trim();
  return cleanText || text;
};

const INITIAL_SETS = [
  {
    id: 'set-alice-wonderland-001',
    company: 'Card.Fun',
    setName: 'Disney Alice in Wonderland',
    releaseDate: '2025-08-27',
    tagline: 'Classic storybook series with parallel foils & character tarot cards',
    sourceUrl: 'https://card.fun/products/301',
    categories: ['Disney', 'Anime'],
    cards: [
      {
        id: 'c-alice-101',
        cardNumber: 'SR-01',
        cardName: 'Nostalgic Story Card',
        cardType: 'SR',
        cardCategory: 'Nostalgic Story Card',
        rarity: 'Rare',
        imageUrl: 'https://goodso.card.fun/20250827Yqo7t3leLiIzAVSfXWvEP0TQkz7rNNmH',
        imageExt: 'none'
      },
      {
        id: 'c-alice-102',
        cardNumber: 'SSR-01',
        cardName: 'Red Heart Trial Card',
        cardType: 'SSR',
        cardCategory: 'Red Heart Trial Card',
        rarity: 'Refractive',
        imageUrl: 'https://goodso.card.fun/20250827CrEbsX5NBpMyFwLB0Hwh41eioHqnUzE8',
        imageExt: 'none'
      },
      {
        id: 'c-alice-103',
        cardNumber: 'CR-01',
        cardName: 'Teacup Drift Card',
        cardType: 'CR',
        cardCategory: 'Teacup Drift Card',
        rarity: 'Numbered',
        imageUrl: 'https://goodso.card.fun/2025082763Osu4kuZnHZ3huR8jxMu6cMxTvmpjFs',
        imageExt: 'none'
      },
      {
        id: 'c-alice-104',
        cardNumber: 'MR-01',
        cardName: 'Wonderland Map Card',
        cardType: 'MR',
        cardCategory: 'Wonderland Map Card',
        rarity: 'Parallel',
        imageUrl: 'https://goodso.card.fun/202508271D1m6szM9mrCVhCuWoiz6YLMs9RHMBvS',
        imageExt: 'none'
      }
    ]
  }
];

const formatImageUrl = (url, ext) => {
  if (!url) return '';
  let cleanUrl = url.trim();

  // Strip temporary Qiniu CDN tokens/parameters if present
  if (cleanUrl.includes('card.fun') && cleanUrl.includes('?')) {
    cleanUrl = cleanUrl.split('?')[0];
  }
  
  if (
    !ext || 
    ext === 'none' || 
    ext === 'auto' || 
    cleanUrl.includes('card.fun') || 
    cleanUrl.includes('?') || 
    cleanUrl.includes('token=') ||
    /\.(jpg|jpeg|png|webp|gif)(\?.*)?$/i.test(cleanUrl)
  ) {
    return cleanUrl;
  }
  
  return `${cleanUrl}.${ext}`;
};

// Smart multi-stage fallback handler for CDN images
const handleImageLoadError = (e, originalUrl) => {
  const img = e.target;
  
  // Stage 1: Strip query parameters/expired tokens if present
  if (!img.dataset.triedClean && originalUrl && originalUrl.includes('?')) {
    img.dataset.triedClean = 'true';
    const cleanUrl = originalUrl.split('?')[0];
    img.src = cleanUrl;
    return;
  }
  
  // Stage 2: Route through weserv.nl SSL image proxy
  if (!img.dataset.triedProxy && originalUrl) {
    img.dataset.triedProxy = 'true';
    const cleanUrl = originalUrl.split('?')[0];
    img.src = `https://images.weserv.nl/?url=${encodeURIComponent(cleanUrl)}`;
    return;
  }

  // Stage 3: Fallback placeholder
  img.onerror = null;
  img.src = 'https://placehold.co/400x600/0f172a/38bdf8?text=Image+Unavailable';
};

function CollectorCardItem({ card, qty, isOwned, onInspect, onUpdateQuantity }) {
  const [orientation, setOrientation] = useState('vertical');

  const handleImageLoad = (e) => {
    const { naturalWidth, naturalHeight } = e.target;
    if (naturalWidth && naturalHeight && naturalWidth > naturalHeight * 1.05) {
      setOrientation('horizontal');
    } else {
      setOrientation('vertical');
    }
  };

  const isHorizontal = orientation === 'horizontal';
  const displayImageUrl = formatImageUrl(card.imageUrl, card.imageExt);

  return (
    <div
      className={`group relative rounded-xl border transition-all duration-300 flex flex-col justify-between overflow-hidden bg-slate-900/80 ${
        isOwned 
          ? 'border-slate-700/80 hover:border-cyan-500/60 shadow-md shadow-cyan-950/20' 
          : 'border-slate-800/50 opacity-65 hover:opacity-100 hover:border-slate-700'
      } ${isHorizontal ? 'sm:col-span-2' : ''}`}
    >
      <div 
        className={`relative w-full bg-slate-950 overflow-hidden cursor-pointer flex items-center justify-center p-2 ${
          isHorizontal ? 'aspect-[4/3]' : 'aspect-[3/4]'
        }`}
        onClick={() => onInspect({ ...card, isHorizontal, displayImageUrl })}
      >
        <img 
          src={displayImageUrl} 
          alt={card.cardName} 
          onLoad={handleImageLoad}
          referrerPolicy="no-referrer"
          className="w-full h-full object-contain transition-transform duration-500 group-hover:scale-105"
          loading="lazy"
          onError={(e) => handleImageLoadError(e, card.imageUrl)}
        />

        <div className="absolute top-2 left-2 z-10 flex gap-1 items-center flex-wrap">
          {card.cardType && (
            <span className="text-[10px] font-black px-2 py-0.5 rounded bg-cyan-950/90 text-cyan-300 border border-cyan-500/40 shadow-sm">
              {card.cardType}
            </span>
          )}
          {isHorizontal && (
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-purple-950/90 text-purple-300 border border-purple-500/40 shadow-sm uppercase tracking-wider">
              Landscape
            </span>
          )}
        </div>

        {isOwned && (
          <div className="absolute bottom-2 right-2 z-10 bg-emerald-500 text-slate-950 font-black text-xs px-2.5 py-0.5 rounded-full shadow-lg">
            x{qty}
          </div>
        )}
      </div>

      <div className="p-3 bg-slate-900 border-t border-slate-800/60 flex-1 flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-mono text-cyan-400 font-bold">{card.cardNumber || '#--'}</span>
            <span className="text-[9px] text-slate-400 border border-slate-800 px-1.5 py-0.5 rounded bg-slate-950">
              {card.rarity || 'Standard'}
            </span>
          </div>
          <h4 className="text-xs font-bold text-slate-200 line-clamp-1 group-hover:text-cyan-300 transition-colors">
            {card.cardName || 'Unnamed Card'}
          </h4>
          <p className="text-[10px] text-slate-400 mt-0.5 line-clamp-1">{card.cardCategory || 'General'}</p>
        </div>

        <div className="mt-3 pt-2 border-t border-slate-800/50 flex items-center justify-between">
          <span className="text-[10px] text-slate-500 font-medium">Owned Qty:</span>
          <div className="flex items-center space-x-1 bg-slate-950 border border-slate-800 rounded-lg p-0.5">
            <button 
              onClick={() => onUpdateQuantity(card.id, -1)}
              disabled={qty === 0}
              className="p-1 hover:bg-slate-800 text-slate-400 hover:text-rose-400 rounded disabled:opacity-30 transition-colors"
              title="Decrease count"
            >
              <Minus className="w-3 h-3" />
            </button>
            <span className="text-xs font-bold font-mono px-2 text-slate-200">{qty}</span>
            <button 
              onClick={() => onUpdateQuantity(card.id, 1)}
              className="p-1 hover:bg-slate-800 text-slate-400 hover:text-emerald-400 rounded transition-colors"
              title="Increase count"
            >
              <Plus className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function AdminCardImagePreview({ imageUrl, imageExt, onFileUpload, compact = false }) {
  const [orientation, setOrientation] = useState('vertical');
  const displayUrl = formatImageUrl(imageUrl, imageExt);

  const handleImageLoad = (e) => {
    const { naturalWidth, naturalHeight } = e.target;
    if (naturalWidth && naturalHeight && naturalWidth > naturalHeight * 1.05) {
      setOrientation('horizontal');
    } else {
      setOrientation('vertical');
    }
  };

  const isHorizontal = orientation === 'horizontal';

  return (
    <div className="flex flex-col items-center w-full">
      <div 
        className={`bg-slate-950 border border-slate-800 rounded-lg overflow-hidden relative flex items-center justify-center mb-1 transition-all p-1 ${
          compact
            ? isHorizontal ? 'w-full aspect-[4/3]' : 'w-full aspect-[3/4]'
            : isHorizontal ? 'w-28 h-20' : 'w-20 h-28'
        }`}
      >
        {displayUrl ? (
          <img 
            src={displayUrl} 
            alt="Card preview" 
            onLoad={handleImageLoad}
            referrerPolicy="no-referrer"
            className="w-full h-full object-contain" 
            onError={(e) => handleImageLoadError(e, imageUrl)}
          />
        ) : (
          <ImageIcon className="w-6 h-6 text-slate-700" />
        )}
        {isHorizontal && (
          <span className="absolute bottom-1 left-1 text-[8px] font-bold bg-purple-950/90 text-purple-300 px-1 rounded border border-purple-800 shadow">
            Horiz
          </span>
        )}
      </div>

      <label className="text-[10px] text-cyan-400 cursor-pointer hover:underline flex items-center gap-1">
        <Upload className="w-3 h-3" /> Upload File
        <input 
          type="file" 
          accept="image/*" 
          className="hidden" 
          onChange={onFileUpload} 
        />
      </label>
    </div>
  );
}

function InspectedCardModal({ card, inventory, onUpdateQuantity, onClose }) {
  const [isHorizontal, setIsHorizontal] = useState(false);

  const handleImageLoad = (e) => {
    const { naturalWidth, naturalHeight } = e.target;
    if (naturalWidth && naturalHeight && naturalWidth > naturalHeight * 1.05) {
      setIsHorizontal(true);
    } else {
      setIsHorizontal(false);
    }
  };

  const qty = inventory[card.id] || 0;
  const displayUrl = card.displayImageUrl || formatImageUrl(card.imageUrl, card.imageExt);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl relative p-6">
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 z-20 w-8 h-8 rounded-full bg-slate-950 text-slate-400 hover:text-white flex items-center justify-center border border-slate-700 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        <div 
          className={`relative mx-auto rounded-xl overflow-hidden shadow-2xl border-2 border-slate-800 mb-6 bg-slate-950 flex items-center justify-center p-2 transition-all ${
            isHorizontal ? 'w-full max-w-md aspect-[4/3]' : 'w-64 aspect-[3/4]'
          }`}
        >
          <img 
            src={displayUrl} 
            alt={card.cardName}
            onLoad={handleImageLoad}
            referrerPolicy="no-referrer"
            className="w-full h-full object-contain" 
            onError={(e) => handleImageLoadError(e, card.imageUrl)}
          />
          {isHorizontal && (
            <span className="absolute top-2 left-2 text-[10px] font-bold bg-purple-950/90 text-purple-300 px-2 py-0.5 rounded border border-purple-800">
              Landscape Mode
            </span>
          )}
        </div>

        <div className="text-center mb-6">
          <div className="flex justify-center items-center gap-2 mb-1">
            <span className="text-xs font-mono font-bold text-cyan-400">{card.cardNumber || '#--'}</span>
            {card.cardType && (
              <span className="text-xs font-bold px-2 py-0.5 bg-cyan-950 border border-cyan-800 text-cyan-300 rounded">
                {card.cardType}
              </span>
            )}
          </div>
          <h3 className="text-xl font-black text-white">{card.cardName || 'Unnamed Card'}</h3>
          <p className="text-xs text-slate-400 mt-1">{card.cardCategory || 'General'} • {card.rarity || 'Base'}</p>
        </div>

        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex items-center justify-between">
          <span className="text-xs text-slate-400 font-medium">Inventory Quantity</span>
          <div className="flex items-center space-x-3">
            <button 
              onClick={() => onUpdateQuantity(card.id, -1)}
              disabled={!qty}
              className="w-9 h-9 bg-slate-900 border border-slate-700 rounded-lg flex items-center justify-center text-slate-300 hover:text-rose-400 disabled:opacity-30 transition-colors"
            >
              <Minus className="w-4 h-4" />
            </button>
            <span className="font-mono font-bold text-xl text-white w-8 text-center">
              {qty}
            </span>
            <button 
              onClick={() => onUpdateQuantity(card.id, 1)}
              className="w-9 h-9 bg-slate-900 border border-slate-700 rounded-lg flex items-center justify-center text-slate-300 hover:text-emerald-400 transition-colors"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ConfirmModal({ isOpen, title, message, onConfirm, onCancel }) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full overflow-hidden shadow-2xl p-6 space-y-4 animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center gap-3 text-amber-400">
          <AlertTriangle className="w-6 h-6 flex-shrink-0 text-amber-500" />
          <h3 className="text-lg font-bold text-white">{title}</h3>
        </div>
        <p className="text-xs text-slate-300 leading-relaxed">{message}</p>
        <div className="flex justify-end space-x-2 pt-2 border-t border-slate-800">
          <button
            onClick={onCancel}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-rose-950/40 transition-colors"
          >
            Confirm Delete
          </button>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [activeTab, setActiveTab] = useState('collector');
  const [adminView, setAdminView] = useState('sets');
  const [adminCardView, setAdminCardView] = useState('full');
  const [sets, setSets] = useState(INITIAL_SETS);
  const [selectedSetId, setSelectedSetId] = useState(INITIAL_SETS[0].id);

  const [companiesList, setCompaniesList] = useState(DEFAULT_COMPANIES);
  const [categoriesList, setCategoriesList] = useState(DEFAULT_CATEGORIES);
  const [cardTypesList, setCardTypesList] = useState(DEFAULT_TYPES);
  const [raritiesList, setRaritiesList] = useState(DEFAULT_RARITIES);
  const [cardCategoriesList, setCardCategoriesList] = useState(DEFAULT_CARD_CATEGORIES);

  const [inventory, setInventory] = useState({
    'c-alice-101': 2,
    'c-alice-102': 1
  });

  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [rarityFilter, setRarityFilter] = useState('ALL');
  const [ownershipFilter, setOwnershipFilter] = useState('ALL');

  const [inspectedCard, setInspectedCard] = useState(null);

  const [toast, setToast] = useState(null);
  const [confirmState, setConfirmState] = useState(null);

  const showToast = (message, type = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const [adminSetForm, setAdminSetForm] = useState({
    id: '',
    company: 'Card.Fun',
    setName: '',
    releaseDate: '',
    tagline: '',
    sourceUrl: '',
    categories: ['Disney'],
    cards: []
  });

  const [selectedCardIds, setSelectedCardIds] = useState([]);
  const [bulkCategory, setBulkCategory] = useState('');
  const [bulkExtFormat, setBulkExtFormat] = useState('none');
  const [bulkType, setBulkType] = useState('');
  const [bulkRarity, setBulkRarity] = useState('');
  const [htmlExtractInput, setHtmlExtractInput] = useState('');
  const [isExtracting, setIsExtracting] = useState(false);

  const [showNewCompanyInput, setShowNewCompanyInput] = useState(false);
  const [newCompanyValue, setNewCompanyValue] = useState('');

  const [showNewTypeInput, setShowNewTypeInput] = useState(false);
  const [newTypeValue, setNewTypeValue] = useState('');

  const [showNewRarityInput, setShowNewRarityInput] = useState(false);
  const [newRarityValue, setNewRarityValue] = useState('');

  const [showNewCardCatInput, setShowNewCardCatInput] = useState(false);
  const [newCardCatValue, setNewCardCatValue] = useState('');

  const currentSet = useMemo(() => {
    return sets.find(s => s.id === selectedSetId) || sets[0] || null;
  }, [sets, selectedSetId]);

  const handleUpdateQuantity = (cardId, delta) => {
    setInventory(prev => {
      const currentQty = prev[cardId] || 0;
      const newQty = Math.max(0, currentQty + delta);
      return { ...prev, [cardId]: newQty };
    });
  };

  const handleStartNewSet = () => {
    const newId = `set-${Date.now()}`;
    const newSetObj = {
      id: newId,
      company: companiesList[1] || 'Card.Fun',
      setName: 'New Untitled Set',
      releaseDate: new Date().toISOString().split('T')[0],
      tagline: '',
      sourceUrl: '',
      categories: [categoriesList[0] || 'TCG'],
      cards: []
    };
    setAdminSetForm(newSetObj);
    setSelectedSetId(newId);
    setActiveTab('admin');
    setAdminView('edit');
    setSelectedCardIds([]);
  };

  const handleEditSetInAdmin = (setObj) => {
    setAdminSetForm({ ...setObj });
    setSelectedSetId(setObj.id);
    setSelectedCardIds([]);
    setActiveTab('admin');
    setAdminView('edit');
  };

  const handleSaveSet = () => {
    if (!adminSetForm.setName.trim()) {
      showToast('Please provide a Set Name before saving.', 'error');
      return;
    }
    setSets(prevSets => {
      const exists = prevSets.some(s => s.id === adminSetForm.id);
      if (exists) {
        return prevSets.map(s => s.id === adminSetForm.id ? adminSetForm : s);
      } else {
        return [...prevSets, adminSetForm];
      }
    });
    setSelectedSetId(adminSetForm.id);
    setAdminView('sets');
    showToast('Set saved successfully!', 'success');
  };

  const handleDeleteSet = (setId, e) => {
    if (e) e.stopPropagation();
    if (sets.length <= 1) {
      showToast('You must keep at least one set in your collection studio.', 'error');
      return;
    }

    const setToDelete = sets.find(s => s.id === setId);
    setConfirmState({
      title: 'Delete Set',
      message: `Are you sure you want to delete "${setToDelete?.setName || 'this set'}" and all its card configurations?`,
      onConfirm: () => {
        const updatedSets = sets.filter(s => s.id !== setId);
        setSets(updatedSets);
        if (selectedSetId === setId) {
          setSelectedSetId(updatedSets[0]?.id || '');
        }
        if (adminSetForm.id === setId) {
          setAdminView('sets');
        }
        showToast('Set deleted successfully.', 'success');
        setConfirmState(null);
      }
    });
  };

  const handleAddCompany = () => {
    if (newCompanyValue.trim()) {
      const val = newCompanyValue.trim();
      if (!companiesList.includes(val)) {
        setCompaniesList([...companiesList, val]);
      }
      setAdminSetForm({ ...adminSetForm, company: val });
      setNewCompanyValue('');
      setShowNewCompanyInput(false);
    }
  };

  const handleAddCardType = () => {
    if (newTypeValue.trim()) {
      const val = newTypeValue.trim().toUpperCase();
      if (!cardTypesList.includes(val)) {
        setCardTypesList([...cardTypesList, val]);
      }
      setNewTypeValue('');
      setShowNewTypeInput(false);
    }
  };

  const handleAddRarity = () => {
    if (newRarityValue.trim()) {
      const val = newRarityValue.trim();
      if (!raritiesList.includes(val)) {
        setRaritiesList([...raritiesList, val]);
      }
      setNewRarityValue('');
      setShowNewRarityInput(false);
    }
  };

  const handleAddCardCategory = () => {
    if (newCardCatValue.trim()) {
      const val = newCardCatValue.trim();
      if (!cardCategoriesList.includes(val)) {
        setCardCategoriesList([...cardCategoriesList, val]);
      }
      setNewCardCatValue('');
      setShowNewCardCatInput(false);
    }
  };

  const handleQuickExtractHtml = () => {
    if (!htmlExtractInput.trim()) return;
    setIsExtracting(true);

    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(htmlExtractInput, 'text/html');
      
      console.group('🔍 Card Extraction Log');

      const partSections = doc.querySelectorAll('.part, div[class*="part"]');
      const cardMap = new Map();

      const processCardItem = (item, defaultType = '') => {
        const imgEl = item.querySelector('img');
        const typeEl = item.querySelector('.type, div[class*="type"]');
        const nameEl = item.querySelector('.name, div[class*="name"]');

        const rawImgSrc = imgEl ? (imgEl.getAttribute('src') || imgEl.src) : '';
        if (!rawImgSrc) return;

        const rawType = typeEl ? typeEl.textContent.trim() : '';
        const rawName = nameEl ? nameEl.textContent.trim() : '';

        // Strip temporary Qiniu tokens to get permanent image key
        const cleanImgUrl = rawImgSrc.includes('card.fun') && rawImgSrc.includes('?')
          ? rawImgSrc.split('?')[0]
          : rawImgSrc;

        const imageKey = cleanImgUrl.split('?')[0];

        const cardTypeVal = defaultType || (rawType.replace(/卡|Card/gi, '').trim());
        const translatedCategory = translateText(rawName || rawType);
        const translatedName = translateText(rawName);

        const isEnglishName = /[a-zA-Z]/.test(rawName) && !/[\u4e00-\u9fa5]/.test(rawName);

        const newCard = {
          id: `c-ext-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          cardNumber: '',
          cardName: translatedName || rawName || 'Card',
          cardType: cardTypeVal || '',
          cardCategory: translatedCategory || 'General',
          rarity: 'Base',
          imageUrl: cleanImgUrl,
          imageExt: 'none'
        };

        if (cardMap.has(imageKey)) {
          if (isEnglishName) {
            const existing = cardMap.get(imageKey);
            cardMap.set(imageKey, {
              ...existing,
              cardName: rawName,
              cardType: cardTypeVal || existing.cardType
            });
          }
        } else {
          cardMap.set(imageKey, newCard);
        }
      };

      if (partSections.length > 0) {
        partSections.forEach(section => {
          const sectionTitleEl = section.querySelector('.part__title, div[class*="part__title"]');
          const sectionType = sectionTitleEl ? sectionTitleEl.textContent.trim() : '';
          const items = section.querySelectorAll('.part__wrap__item, div[class*="part__wrap__item"]');
          items.forEach(item => processCardItem(item, sectionType));
        });
      } else {
        const items = doc.querySelectorAll('.part__wrap__item, div[class*="part__wrap__item"]');
        items.forEach(item => processCardItem(item));
      }

      const extractedCards = Array.from(cardMap.values());
      console.log(`Extraction complete! Unique cards parsed: ${extractedCards.length}`);
      console.groupEnd();

      if (extractedCards.length > 0) {
        setAdminSetForm(prev => ({
          ...prev,
          cards: [...prev.cards, ...extractedCards]
        }));
        setHtmlExtractInput('');
        showToast(`Extracted ${extractedCards.length} unique cards successfully!`, 'success');
      } else {
        showToast('No card elements found. Please check HTML string structure.', 'error');
      }
    } catch (err) {
      console.error('Error extracting cards from HTML:', err);
      showToast('Failed to parse HTML string.', 'error');
    } finally {
      setIsExtracting(false);
    }
  };

  const handleAddCardRow = () => {
    const newCard = {
      id: `c-row-${Date.now()}`,
      cardNumber: '',
      cardName: '',
      cardType: cardTypesList[0] || 'CR',
      cardCategory: cardCategoriesList[0] || 'Living Space Card',
      rarity: raritiesList[0] || 'Base',
      imageUrl: '',
      imageExt: 'none'
    };
    setAdminSetForm(prev => ({
      ...prev,
      cards: [...prev.cards, newCard]
    }));
  };

  const handleUpdateCardField = (cardId, field, value) => {
    setAdminSetForm(prev => ({
      ...prev,
      cards: prev.cards.map(c => c.id === cardId ? { ...c, [field]: value } : c)
    }));
  };

  const handleDeleteCardRow = (cardId) => {
    setAdminSetForm(prev => ({
      ...prev,
      cards: prev.cards.filter(c => c.id !== cardId)
    }));
    setSelectedCardIds(prev => prev.filter(id => id !== cardId));
  };

  const handleToggleSelectCard = (cardId) => {
    setSelectedCardIds(prev => 
      prev.includes(cardId) ? prev.filter(id => id !== cardId) : [...prev, cardId]
    );
  };

  const handleSelectAllCards = () => {
    if (selectedCardIds.length === adminSetForm.cards.length && adminSetForm.cards.length > 0) {
      setSelectedCardIds([]);
    } else {
      setSelectedCardIds(adminSetForm.cards.map(c => c.id));
    }
  };

  const handleApplyBulkCategory = () => {
    if (!bulkCategory) return;
    setAdminSetForm(prev => ({
      ...prev,
      cards: prev.cards.map(c => selectedCardIds.includes(c.id) ? { ...c, cardCategory: bulkCategory } : c)
    }));
    showToast(`Updated category for ${selectedCardIds.length} cards.`, 'success');
  };

  const handleApplyBulkExtFormat = () => {
    setAdminSetForm(prev => ({
      ...prev,
      cards: prev.cards.map(c => selectedCardIds.includes(c.id) ? { ...c, imageExt: bulkExtFormat } : c)
    }));
    showToast(`Updated format extension for ${selectedCardIds.length} cards.`, 'success');
  };

  const handleApplyBulkType = () => {
    if (!bulkType) return;
    setAdminSetForm(prev => ({
      ...prev,
      cards: prev.cards.map(c => selectedCardIds.includes(c.id) ? { ...c, cardType: bulkType } : c)
    }));
    showToast(`Updated card type for ${selectedCardIds.length} cards.`, 'success');
  };

  const handleApplyBulkRarity = () => {
    if (!bulkRarity) return;
    setAdminSetForm(prev => ({
      ...prev,
      cards: prev.cards.map(c => selectedCardIds.includes(c.id) ? { ...c, rarity: bulkRarity } : c)
    }));
    showToast(`Updated rarity for ${selectedCardIds.length} cards.`, 'success');
  };

  const handleBulkDelete = () => {
    if (selectedCardIds.length === 0) return;
    const count = selectedCardIds.length;
    setConfirmState({
      title: 'Delete Selected Cards',
      message: `Are you sure you want to delete ${count} selected card${count > 1 ? 's' : ''}?`,
      onConfirm: () => {
        setAdminSetForm(prev => ({
          ...prev,
          cards: prev.cards.filter(c => !selectedCardIds.includes(c.id))
        }));
        setSelectedCardIds([]);
        showToast(`${count} card${count > 1 ? 's' : ''} deleted successfully.`, 'success');
        setConfirmState(null);
      }
    });
  };

  const handleCardFileUpload = (e, cardId) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        handleUpdateCardField(cardId, 'imageUrl', reader.result);
        handleUpdateCardField(cardId, 'imageExt', 'none');
      };
      reader.readAsDataURL(file);
    }
  };

  const filteredCards = useMemo(() => {
    if (!currentSet) return [];
    return currentSet.cards.filter(card => {
      const query = searchTerm.toLowerCase();
      const matchesSearch = 
        !query || 
        (card.cardName && card.cardName.toLowerCase().includes(query)) ||
        (card.cardNumber && card.cardNumber.toLowerCase().includes(query)) ||
        (card.cardCategory && card.cardCategory.toLowerCase().includes(query));

      const matchesType = typeFilter === 'ALL' || card.cardType === typeFilter;
      const matchesCategory = categoryFilter === 'ALL' || card.cardCategory === categoryFilter;
      const matchesRarity = rarityFilter === 'ALL' || card.rarity === rarityFilter;

      const qty = inventory[card.id] || 0;
      let matchesOwnership = true;
      if (ownershipFilter === 'OWNED') matchesOwnership = qty > 0;
      if (ownershipFilter === 'MISSING') matchesOwnership = qty === 0;
      if (ownershipFilter === 'DUPLICATES') matchesOwnership = qty > 1;

      return matchesSearch && matchesType && matchesCategory && matchesRarity && matchesOwnership;
    });
  }, [currentSet, searchTerm, typeFilter, categoryFilter, rarityFilter, ownershipFilter, inventory]);

  const setProgress = useMemo(() => {
    if (!currentSet || currentSet.cards.length === 0) return { total: 0, collected: 0, pct: 0, totalCopies: 0 };
    const total = currentSet.cards.length;
    let collected = 0;
    let totalCopies = 0;

    currentSet.cards.forEach(c => {
      const qty = inventory[c.id] || 0;
      if (qty > 0) collected += 1;
      totalCopies += qty;
    });

    const pct = Math.round((collected / total) * 100);
    return { total, collected, pct, totalCopies };
  }, [currentSet, inventory]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-cyan-500 selection:text-slate-950 relative">
      
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl shadow-2xl border flex items-center gap-2 text-xs font-bold transition-all animate-in slide-in-from-top-2 ${
          toast.type === 'error' 
            ? 'bg-rose-950 text-rose-200 border-rose-800' 
            : 'bg-emerald-950 text-emerald-200 border-emerald-800'
        }`}>
          {toast.type === 'error' ? <AlertTriangle className="w-4 h-4 text-rose-400" /> : <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
          {toast.message}
        </div>
      )}

      <ConfirmModal
        isOpen={!!confirmState}
        title={confirmState?.title || ''}
        message={confirmState?.message || ''}
        onConfirm={() => confirmState?.onConfirm()}
        onCancel={() => setConfirmState(null)}
      />

      <header className="border-b border-slate-800 bg-slate-900/90 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
              <Layers className="w-5 h-5 text-slate-950 font-bold" />
            </div>
            <div>
              <h1 className="text-base font-black tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
                CARD VAULT STUDIO
              </h1>
              <p className="text-[10px] text-cyan-400 font-mono tracking-widest uppercase">Multi-Set Collector Dashboard</p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setActiveTab('collector')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === 'collector'
                  ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Eye className="w-3.5 h-3.5" /> Collector View
            </button>

            <button
              onClick={() => {
                setActiveTab('admin');
                setAdminView('sets');
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === 'admin'
                  ? 'bg-purple-600 text-white shadow-md shadow-purple-600/20'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Settings className="w-3.5 h-3.5" /> Admin Studio
            </button>

            <button
              onClick={handleStartNewSet}
              className="px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition-all flex items-center gap-1.5 shadow-md shadow-emerald-900/30"
            >
              <Plus className="w-3.5 h-3.5" /> Create New Set
            </button>
          </div>

        </div>
      </header>

      <div className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        
        {/* ==================== COLLECTOR VIEW ==================== */}
        {activeTab === 'collector' && (
          <div className="space-y-6">
            
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                  <Database className="w-4 h-4 text-cyan-400" /> Card Sets Vault
                </h2>
                <span className="text-xs text-slate-500">{sets.length} Sets Available</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {sets.map(set => {
                  const isSelected = set.id === selectedSetId;
                  return (
                    <div
                      key={set.id}
                      onClick={() => setSelectedSetId(set.id)}
                      className={`cursor-pointer rounded-xl p-3 border transition-all relative group flex flex-col justify-between ${
                        isSelected 
                          ? 'bg-slate-900 border-cyan-500 shadow-md shadow-cyan-950/40' 
                          : 'bg-slate-900/50 border-slate-800/80 hover:border-slate-700 hover:bg-slate-900/80'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider">{set.company}</span>
                          <div className="flex items-center gap-1">
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-950 text-slate-400 border border-slate-800">
                              {set.cards?.length || 0} Cards
                            </span>
                            <button
                              onClick={(e) => handleDeleteSet(set.id, e)}
                              className="p-1 hover:text-rose-400 text-slate-600 transition-colors"
                              title="Delete set"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                        <h3 className="text-sm font-bold text-white line-clamp-1">{set.setName}</h3>
                        <p className="text-[11px] text-slate-400 line-clamp-1 mt-0.5">{set.tagline || 'Collection set'}</p>
                      </div>

                      <div className="mt-3 pt-2 border-t border-slate-800/60 flex items-center justify-between text-[10px] text-slate-500">
                        <span>{set.categories?.join(', ')}</span>
                        {isSelected && <span className="text-cyan-400 font-bold flex items-center gap-1"><Check className="w-3 h-3" /> Active</span>}
                      </div>
                    </div>
                  );
                })}

                <div
                  onClick={handleStartNewSet}
                  className="cursor-pointer rounded-xl p-4 border border-dashed border-slate-800 hover:border-emerald-500/60 bg-slate-900/20 hover:bg-emerald-950/10 transition-all flex flex-col items-center justify-center text-center group min-h-[100px]"
                >
                  <div className="w-8 h-8 rounded-full bg-slate-900 group-hover:bg-emerald-600 text-slate-400 group-hover:text-slate-950 flex items-center justify-center mb-1.5 transition-colors">
                    <Plus className="w-4 h-4" />
                  </div>
                  <span className="text-xs font-bold text-slate-300 group-hover:text-emerald-400">Create New Set</span>
                  <span className="text-[10px] text-slate-500">Configure checklist & images</span>
                </div>
              </div>
            </div>

            {currentSet && (
              <div className="bg-gradient-to-r from-slate-900 via-slate-900/90 to-slate-950 border border-slate-800 rounded-2xl p-5 shadow-xl">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  
                  <div>
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="px-2 py-0.5 bg-cyan-950 border border-cyan-800 text-cyan-300 font-bold text-[10px] rounded">
                        {currentSet.company}
                      </span>
                      {currentSet.categories?.map(cat => (
                        <span key={cat} className="px-2 py-0.5 bg-slate-800 text-slate-300 text-[10px] rounded">
                          {cat}
                        </span>
                      ))}
                      {currentSet.releaseDate && (
                        <span className="text-[10px] text-slate-500 font-mono">Released: {currentSet.releaseDate}</span>
                      )}
                    </div>
                    <h2 className="text-2xl font-black text-white">{currentSet.setName}</h2>
                    {currentSet.tagline && <p className="text-xs text-slate-400 mt-1">{currentSet.tagline}</p>}
                    {currentSet.sourceUrl && (
                      <a 
                        href={currentSet.sourceUrl} 
                        target="_blank" 
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] text-cyan-400 hover:underline mt-2"
                      >
                        <Globe className="w-3 h-3" /> View Source Checklist <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    )}
                  </div>

                  <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 min-w-[240px]">
                    <div className="flex justify-between items-center text-xs mb-1.5">
                      <span className="text-slate-400 font-medium">Set Completion</span>
                      <span className="font-mono font-bold text-cyan-400">{setProgress.pct}%</span>
                    </div>

                    <div className="w-full bg-slate-900 h-2.5 rounded-full overflow-hidden border border-slate-800 mb-2">
                      <div 
                        className="bg-gradient-to-r from-cyan-500 to-emerald-400 h-full transition-all duration-500 rounded-full"
                        style={{ width: `${setProgress.pct}%` }}
                      />
                    </div>

                    <div className="flex justify-between items-center text-[11px] text-slate-400">
                      <span>Unique Cards: <strong className="text-white">{setProgress.collected} / {setProgress.total}</strong></span>
                      <span>Total Copies: <strong className="text-emerald-400">{setProgress.totalCopies}</strong></span>
                    </div>
                  </div>

                </div>
              </div>
            )}

            <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 space-y-3">
              
              <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
                <div className="relative w-full md:w-80">
                  <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
                  <input 
                    type="text"
                    placeholder="Search by name, number, category..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                  />
                  {searchTerm && (
                    <button 
                      onClick={() => setSearchTerm('')}
                      className="absolute right-2.5 top-2.5 text-slate-500 hover:text-white text-xs"
                    >
                      ✕
                    </button>
                  )}
                </div>

                <div className="flex items-center space-x-1 bg-slate-950 p-1 border border-slate-800 rounded-lg w-full md:w-auto overflow-x-auto">
                  {[
                    { id: 'ALL', label: 'All Cards' },
                    { id: 'OWNED', label: 'Owned' },
                    { id: 'MISSING', label: 'Missing' },
                    { id: 'DUPLICATES', label: 'Duplicates' }
                  ].map(opt => (
                    <button
                      key={opt.id}
                      onClick={() => setOwnershipFilter(opt.id)}
                      className={`px-3 py-1 rounded-md text-xs font-bold transition-all whitespace-nowrap ${
                        ownershipFilter === opt.id 
                          ? 'bg-slate-800 text-cyan-300 border border-slate-700' 
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 pt-2 border-t border-slate-800/60 text-xs">
                <div>
                  <label className="text-[10px] text-slate-500 mb-1 block">Card Type</label>
                  <select 
                    value={typeFilter}
                    onChange={(e) => setTypeFilter(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 text-slate-300 focus:border-cyan-500"
                  >
                    <option value="ALL">All Types</option>
                    {cardTypesList.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] text-slate-500 mb-1 block">Card Category</label>
                  <select 
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 text-slate-300 focus:border-cyan-500"
                  >
                    <option value="ALL">All Categories</option>
                    {cardCategoriesList.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>

                <div className="col-span-2 md:col-span-1">
                  <label className="text-[10px] text-slate-500 mb-1 block">Rarity</label>
                  <select 
                    value={rarityFilter}
                    onChange={(e) => setRarityFilter(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 text-slate-300 focus:border-cyan-500"
                  >
                    <option value="ALL">All Rarities</option>
                    {raritiesList.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
              </div>

            </div>

            {filteredCards.length === 0 ? (
              <div className="text-center py-16 border border-dashed border-slate-800 rounded-2xl bg-slate-900/30">
                <Info className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                <h3 className="text-base font-bold text-slate-300">No cards match the current filters</h3>
                <p className="text-xs text-slate-500 mt-1">Try resetting search keywords or category choices.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {filteredCards.map(card => {
                  const qty = inventory[card.id] || 0;
                  const isOwned = qty > 0;
                  return (
                    <CollectorCardItem
                      key={card.id}
                      card={card}
                      qty={qty}
                      isOwned={isOwned}
                      onInspect={setInspectedCard}
                      onUpdateQuantity={handleUpdateQuantity}
                    />
                  );
                })}
              </div>
            )}

          </div>
        )}

        {/* ==================== ADMIN STUDIO VIEW ==================== */}
        {activeTab === 'admin' && (
          <div className="space-y-6">
            
            {adminView === 'sets' && (
              <div className="space-y-6">
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-black text-white flex items-center gap-2">
                      <Settings className="w-5 h-5 text-purple-400" /> Admin Studio — Manage Sets
                    </h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Select a set to edit its details and card checklist, or create a brand new set.
                    </p>
                  </div>

                  <button
                    onClick={handleStartNewSet}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-emerald-900/30 flex items-center gap-1.5 transition-all self-start sm:self-auto"
                  >
                    <Plus className="w-4 h-4" /> Create New Set
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {sets.map(set => (
                    <div 
                      key={set.id}
                      className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 hover:border-slate-700 transition-all flex flex-col justify-between shadow-lg"
                    >
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-bold text-cyan-400 uppercase tracking-wider px-2 py-0.5 rounded bg-cyan-950/80 border border-cyan-800">
                            {set.company}
                          </span>
                          <span className="text-xs font-mono font-bold text-slate-400 border border-slate-800 px-2 py-0.5 rounded bg-slate-950">
                            {set.cards?.length || 0} Cards
                          </span>
                        </div>

                        <h3 className="text-lg font-black text-white line-clamp-1">{set.setName}</h3>
                        {set.tagline && <p className="text-xs text-slate-400 line-clamp-2 mt-1">{set.tagline}</p>}

                        {set.releaseDate && (
                          <p className="text-[11px] text-slate-500 font-mono mt-2">
                            Released: {set.releaseDate}
                          </p>
                        )}
                      </div>

                      <div className="mt-5 pt-3 border-t border-slate-800/80 flex items-center justify-between gap-2">
                        <button
                          onClick={() => handleEditSetInAdmin(set)}
                          className="flex-1 py-2 bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 shadow-md shadow-purple-900/30 transition-all"
                        >
                          <Edit className="w-3.5 h-3.5" /> Edit Set & Cards
                        </button>

                        <button
                          onClick={(e) => handleDeleteSet(set.id, e)}
                          className="px-3 py-2 bg-slate-950 hover:bg-rose-950/80 text-slate-400 hover:text-rose-400 border border-slate-800 hover:border-rose-800 rounded-xl transition-all"
                          title="Delete set"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}

                  <div 
                    onClick={handleStartNewSet}
                    className="bg-slate-900/30 border-2 border-dashed border-slate-800 hover:border-emerald-500/60 rounded-2xl p-6 flex flex-col items-center justify-center text-center cursor-pointer group min-h-[200px] transition-all"
                  >
                    <div className="w-12 h-12 rounded-full bg-slate-900 group-hover:bg-emerald-600 text-slate-400 group-hover:text-slate-950 flex items-center justify-center mb-3 transition-colors">
                      <Plus className="w-6 h-6" />
                    </div>
                    <h3 className="text-sm font-bold text-slate-200 group-hover:text-emerald-400">Create New Set</h3>
                    <p className="text-xs text-slate-500 max-w-xs mt-1">Configure new set metadata, card checklist, and HTML extraction options</p>
                  </div>
                </div>
              </div>
            )}

            {adminView === 'edit' && (
              <div className="space-y-6">
                
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setAdminView('sets')}
                      className="px-3 py-1.5 bg-slate-950 hover:bg-slate-800 border border-slate-700 text-slate-300 font-bold text-xs rounded-xl transition-colors"
                    >
                      ← Back to Sets
                    </button>
                    <div>
                      <h2 className="text-lg font-black text-white flex items-center gap-2">
                        Editing: <span className="text-purple-400">{adminSetForm.setName || 'Untitled Set'}</span>
                      </h2>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Configure metadata, extract web cards, and switch density views.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <div className="flex items-center bg-slate-950 border border-slate-800 p-1 rounded-xl text-xs">
                      <button
                        onClick={() => setAdminCardView('full')}
                        className={`px-3 py-1 rounded-lg font-bold transition-all flex items-center gap-1 ${
                          adminCardView === 'full' 
                            ? 'bg-purple-600 text-white shadow-sm' 
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        <Layers className="w-3.5 h-3.5" /> Full View
                      </button>
                      <button
                        onClick={() => setAdminCardView('compact')}
                        className={`px-3 py-1 rounded-lg font-bold transition-all flex items-center gap-1 ${
                          adminCardView === 'compact' 
                            ? 'bg-purple-600 text-white shadow-sm' 
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        <ImageIcon className="w-3.5 h-3.5" /> Compact View
                      </button>
                    </div>

                    <button
                      onClick={handleSaveSet}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-emerald-900/40 flex items-center gap-1.5 transition-all"
                    >
                      <Check className="w-4 h-4" /> Save Changes
                    </button>
                  </div>
                </div>

                <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 space-y-4">
                  <h3 className="text-xs font-bold text-cyan-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5" /> Set Information
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className="text-xs text-slate-400 font-medium">Company / Publisher</label>
                        <button 
                          onClick={() => setShowNewCompanyInput(!showNewCompanyInput)}
                          className="text-[10px] text-cyan-400 hover:underline flex items-center gap-0.5"
                        >
                          + New
                        </button>
                      </div>

                      {showNewCompanyInput ? (
                        <div className="flex gap-1">
                          <input 
                            type="text" 
                            placeholder="New Company"
                            value={newCompanyValue}
                            onChange={(e) => setNewCompanyValue(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-white"
                          />
                          <button onClick={handleAddCompany} className="px-2 bg-cyan-600 text-white rounded text-xs">Add</button>
                        </div>
                      ) : (
                        <select 
                          value={adminSetForm.company}
                          onChange={(e) => setAdminSetForm({ ...adminSetForm, company: e.target.value })}
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:border-cyan-500"
                        >
                          {companiesList.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      )}
                    </div>

                    <div>
                      <label className="text-xs text-slate-400 font-medium mb-1 block">Set Name *</label>
                      <input 
                        type="text"
                        placeholder="e.g., Princess Diaries, Mandalorian"
                        value={adminSetForm.setName}
                        onChange={(e) => setAdminSetForm({ ...adminSetForm, setName: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:border-cyan-500"
                      />
                    </div>

                    <div>
                      <label className="text-xs text-slate-400 font-medium mb-1 block">Release Date (Optional)</label>
                      <input 
                        type="date"
                        value={adminSetForm.releaseDate}
                        onChange={(e) => setAdminSetForm({ ...adminSetForm, releaseDate: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:border-cyan-500"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="text-xs text-slate-400 font-medium mb-1 block">Tagline (Optional)</label>
                      <input 
                        type="text"
                        placeholder="Princess Collection with numbered cards & embossed finish"
                        value={adminSetForm.tagline}
                        onChange={(e) => setAdminSetForm({ ...adminSetForm, tagline: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:border-cyan-500"
                      />
                    </div>

                    <div>
                      <label className="text-xs text-slate-400 font-medium mb-1 block">Source Link (Optional)</label>
                      <input 
                        type="url"
                        placeholder="https://card.fun/products/301"
                        value={adminSetForm.sourceUrl}
                        onChange={(e) => setAdminSetForm({ ...adminSetForm, sourceUrl: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:border-cyan-500"
                      />
                    </div>

                  </div>
                </div>

                <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5" /> Quick HTML Scraper (Card.Fun / Web Extraction)
                    </h3>
                    <span className="text-[10px] text-slate-500">Logs each indexed card to Console (F12)</span>
                  </div>

                  <p className="text-xs text-slate-400">
                    Paste raw HTML containing <code className="text-cyan-400">&lt;div class="part__wrap__item"&gt;</code> elements. The scraper extracts card names, images, and translates series titles.
                  </p>

                  <div className="flex gap-2">
                    <textarea 
                      rows={3}
                      placeholder='Paste HTML here... e.g., <div class="part__wrap__item"><img src="..."><div class="type">...</div><div class="name">...</div></div>'
                      value={htmlExtractInput}
                      onChange={(e) => setHtmlExtractInput(e.target.value)}
                      className="flex-1 bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white font-mono focus:outline-none focus:border-amber-500"
                    />
                    <button
                      onClick={handleQuickExtractHtml}
                      disabled={isExtracting || !htmlExtractInput.trim()}
                      className="px-4 py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-slate-950 font-bold text-xs rounded-xl flex flex-col items-center justify-center transition-all min-w-[120px]"
                    >
                      {isExtracting ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4 mb-1" />
                          Extract Cards
                        </>
                      )}
                    </button>
                  </div>
                </div>

                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center space-x-2">
                      <button 
                        onClick={handleSelectAllCards}
                        className="text-xs bg-slate-950 hover:bg-slate-800 border border-slate-700 px-3 py-1.5 rounded-lg flex items-center gap-1.5 text-slate-300"
                      >
                        {selectedCardIds.length === adminSetForm.cards.length && adminSetForm.cards.length > 0 ? (
                          <CheckSquare className="w-3.5 h-3.5 text-cyan-400" />
                        ) : (
                          <Square className="w-3.5 h-3.5 text-slate-500" />
                        )}
                        Select All ({selectedCardIds.length}/{adminSetForm.cards.length})
                      </button>

                      {selectedCardIds.length > 0 && (
                        <button 
                          onClick={handleBulkDelete}
                          className="text-xs bg-rose-950/80 hover:bg-rose-900 border border-rose-800 text-rose-300 px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Delete Selected ({selectedCardIds.length})
                        </button>
                      )}
                    </div>

                    <button 
                      onClick={handleAddCardRow}
                      className="text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-3 py-1.5 rounded-lg flex items-center gap-1 self-end sm:self-auto"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add Blank Card Row
                    </button>
                  </div>

                  {selectedCardIds.length > 0 && (
                    <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                      
                      <div className="flex gap-1">
                        <select 
                          value={bulkExtFormat}
                          onChange={(e) => setBulkExtFormat(e.target.value)}
                          className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white flex-1"
                        >
                          <option value="none">None (As Is)</option>
                          <option value="png">Format .png</option>
                          <option value="jpg">Format .jpg</option>
                          <option value="webp">Format .webp</option>
                        </select>
                        <button onClick={handleApplyBulkExtFormat} className="px-2 bg-slate-800 hover:bg-slate-700 text-cyan-300 rounded text-[11px] font-bold">Apply</button>
                      </div>

                      <div className="flex gap-1">
                        <select 
                          value={bulkCategory}
                          onChange={(e) => setBulkCategory(e.target.value)}
                          className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white flex-1"
                        >
                          <option value="">Set Category...</option>
                          {cardCategoriesList.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                        <button onClick={handleApplyBulkCategory} className="px-2 bg-slate-800 hover:bg-slate-700 text-cyan-300 rounded text-[11px] font-bold">Apply</button>
                      </div>

                      <div className="flex gap-1">
                        <select 
                          value={bulkType}
                          onChange={(e) => setBulkType(e.target.value)}
                          className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white flex-1"
                        >
                          <option value="">Set Card Type...</option>
                          {cardTypesList.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                        <button onClick={handleApplyBulkType} className="px-2 bg-slate-800 hover:bg-slate-700 text-cyan-300 rounded text-[11px] font-bold">Apply</button>
                      </div>

                      <div className="flex gap-1">
                        <select 
                          value={bulkRarity}
                          onChange={(e) => setBulkRarity(e.target.value)}
                          className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white flex-1"
                        >
                          <option value="">Set Rarity...</option>
                          {raritiesList.map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                        <button onClick={handleApplyBulkRarity} className="px-2 bg-slate-800 hover:bg-slate-700 text-cyan-300 rounded text-[11px] font-bold">Apply</button>
                      </div>

                    </div>
                  )}
                </div>

                <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 flex items-center justify-between gap-4 flex-wrap text-xs">
                  <span className="text-slate-400 font-bold">Add Custom Metadata:</span>

                  <div className="flex items-center gap-1">
                    {showNewTypeInput ? (
                      <div className="flex gap-1">
                        <input 
                          type="text" 
                          placeholder="e.g. SGR"
                          value={newTypeValue}
                          onChange={(e) => setNewTypeValue(e.target.value)}
                          className="bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-white w-24"
                        />
                        <button onClick={handleAddCardType} className="px-2 bg-cyan-600 text-white rounded">Add</button>
                      </div>
                    ) : (
                      <button onClick={() => setShowNewTypeInput(true)} className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-cyan-300 rounded">
                        + Card Type
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    {showNewCardCatInput ? (
                      <div className="flex gap-1">
                        <input 
                          type="text" 
                          placeholder="e.g. Mirror Foil"
                          value={newCardCatValue}
                          onChange={(e) => setNewCardCatValue(e.target.value)}
                          className="bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-white w-28"
                        />
                        <button onClick={handleAddCardCategory} className="px-2 bg-cyan-600 text-white rounded">Add</button>
                      </div>
                    ) : (
                      <button onClick={() => setShowNewCardCatInput(true)} className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-cyan-300 rounded">
                        + Card Category
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    {showNewRarityInput ? (
                      <div className="flex gap-1">
                        <input 
                          type="text" 
                          placeholder="e.g. Starlight"
                          value={newRarityValue}
                          onChange={(e) => setNewRarityValue(e.target.value)}
                          className="bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-white w-24"
                        />
                        <button onClick={handleAddRarity} className="px-2 bg-cyan-600 text-white rounded">Add</button>
                      </div>
                    ) : (
                      <button onClick={() => setShowNewRarityInput(true)} className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-cyan-300 rounded">
                        + Rarity Tier
                      </button>
                    )}
                  </div>
                </div>

                {adminSetForm.cards.length === 0 ? (
                  <div className="text-center py-12 border border-dashed border-slate-800 rounded-2xl bg-slate-900/30">
                    <p className="text-xs text-slate-500">No cards in this set yet. Use the Quick Scraper above or click "Add Blank Card Row".</p>
                  </div>
                ) : (
                  <div>
                    {adminCardView === 'compact' ? (
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                        {adminSetForm.cards.map((cItem) => {
                          const isSelected = selectedCardIds.includes(cItem.id);
                          return (
                            <div 
                              key={cItem.id} 
                              className={`p-3 rounded-xl border flex flex-col justify-between transition-all relative ${
                                isSelected 
                                  ? 'bg-slate-900 border-cyan-500 shadow-md shadow-cyan-950/30' 
                                  : 'bg-slate-900/80 border-slate-800/80 hover:border-slate-700'
                              }`}
                            >
                              <div>
                                <div className="flex items-center justify-between mb-2">
                                  <button onClick={() => handleToggleSelectCard(cItem.id)} className="text-slate-400">
                                    {isSelected ? <CheckSquare className="w-4 h-4 text-cyan-400" /> : <Square className="w-4 h-4 text-slate-600" />}
                                  </button>
                                  <button 
                                    onClick={() => handleDeleteCardRow(cItem.id)}
                                    className="p-1 hover:text-rose-400 text-slate-600 transition-colors"
                                    title="Delete Card"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>

                                <AdminCardImagePreview 
                                  imageUrl={cItem.imageUrl}
                                  imageExt={cItem.imageExt}
                                  compact={true}
                                  onFileUpload={(e) => handleCardFileUpload(e, cItem.id)}
                                />

                                <div className="space-y-1.5 mt-2">
                                  <input 
                                    type="text"
                                    placeholder="Card Name"
                                    value={cItem.cardName}
                                    onChange={(e) => handleUpdateCardField(cItem.id, 'cardName', e.target.value)}
                                    className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs font-bold text-white"
                                  />

                                  <div className="grid grid-cols-2 gap-1 text-[10px]">
                                    <select 
                                      value={cItem.cardCategory}
                                      onChange={(e) => handleUpdateCardField(cItem.id, 'cardCategory', e.target.value)}
                                      className="w-full bg-slate-950 border border-slate-800 rounded px-1 py-1 text-slate-300"
                                    >
                                      {cardCategoriesList.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                                    </select>

                                    <select 
                                      value={cItem.cardType}
                                      onChange={(e) => handleUpdateCardField(cItem.id, 'cardType', e.target.value)}
                                      className="w-full bg-slate-950 border border-slate-800 rounded px-1 py-1 text-cyan-300 font-bold"
                                    >
                                      <option value="">Type...</option>
                                      {cardTypesList.map(t => <option key={t} value={t}>{t}</option>)}
                                    </select>
                                  </div>

                                  <div className="flex gap-1 text-[10px]">
                                    <input 
                                      type="text" 
                                      placeholder="Image URL..."
                                      value={cItem.imageUrl}
                                      onChange={(e) => handleUpdateCardField(cItem.id, 'imageUrl', e.target.value)}
                                      className="flex-1 bg-slate-950 border border-slate-800 rounded px-1.5 py-0.5 text-slate-400 font-mono text-[9px]"
                                    />
                                    <select
                                      value={cItem.imageExt || 'none'}
                                      onChange={(e) => handleUpdateCardField(cItem.id, 'imageExt', e.target.value)}
                                      className="bg-slate-950 border border-slate-800 rounded px-1 py-0.5 text-cyan-400 font-mono text-[9px]"
                                    >
                                      <option value="none">As Is</option>
                                      <option value="png">.png</option>
                                      <option value="jpg">.jpg</option>
                                      <option value="webp">.webp</option>
                                    </select>
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {adminSetForm.cards.map((cItem) => {
                          const isSelected = selectedCardIds.includes(cItem.id);
                          return (
                            <div 
                              key={cItem.id} 
                              className={`p-4 rounded-xl border transition-all ${
                                isSelected 
                                  ? 'bg-slate-900 border-cyan-500' 
                                  : 'bg-slate-900/70 border-slate-800/80 hover:border-slate-700'
                              }`}
                            >
                              <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                                
                                <div className="md:col-span-2 flex items-center space-x-3">
                                  <button onClick={() => handleToggleSelectCard(cItem.id)} className="text-slate-400">
                                    {isSelected ? <CheckSquare className="w-4 h-4 text-cyan-400" /> : <Square className="w-4 h-4 text-slate-600" />}
                                  </button>
                                  <AdminCardImagePreview 
                                    imageUrl={cItem.imageUrl}
                                    imageExt={cItem.imageExt}
                                    onFileUpload={(e) => handleCardFileUpload(e, cItem.id)}
                                  />
                                </div>

                                <div className="md:col-span-4 space-y-1">
                                  <label className="text-[10px] text-slate-500 font-medium">Image URL Link & Format Extension</label>
                                  <div className="flex gap-1">
                                    <input 
                                      type="text" 
                                      placeholder="Image Link URL..."
                                      value={cItem.imageUrl}
                                      onChange={(e) => handleUpdateCardField(cItem.id, 'imageUrl', e.target.value)}
                                      className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-white focus:border-cyan-500 font-mono"
                                    />
                                    <select
                                      value={cItem.imageExt || 'none'}
                                      onChange={(e) => handleUpdateCardField(cItem.id, 'imageExt', e.target.value)}
                                      className="bg-slate-950 border border-slate-800 rounded px-2 py-1.5 text-xs text-cyan-300 font-mono"
                                      title="Select file extension appended to URL"
                                    >
                                      <option value="none">None (As Is)</option>
                                      <option value="png">.png</option>
                                      <option value="jpg">.jpg</option>
                                      <option value="webp">.webp</option>
                                    </select>
                                  </div>
                                </div>

                                <div className="md:col-span-5 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                                  
                                  <div>
                                    <label className="text-[10px] text-slate-500 block mb-0.5">Card Name</label>
                                    <input 
                                      type="text"
                                      placeholder="Name"
                                      value={cItem.cardName}
                                      onChange={(e) => handleUpdateCardField(cItem.id, 'cardName', e.target.value)}
                                      className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-white"
                                    />
                                  </div>

                                  <div>
                                    <label className="text-[10px] text-slate-500 block mb-0.5">Category</label>
                                    <select 
                                      value={cItem.cardCategory}
                                      onChange={(e) => handleUpdateCardField(cItem.id, 'cardCategory', e.target.value)}
                                      className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-white"
                                    >
                                      {cardCategoriesList.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                                    </select>
                                  </div>

                                  <div>
                                    <label className="text-[10px] text-slate-500 block mb-0.5">Card Type</label>
                                    <select 
                                      value={cItem.cardType}
                                      onChange={(e) => handleUpdateCardField(cItem.id, 'cardType', e.target.value)}
                                      className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-white"
                                    >
                                      <option value="">(None)</option>
                                      {cardTypesList.map(t => <option key={t} value={t}>{t}</option>)}
                                    </select>
                                  </div>

                                  <div>
                                    <label className="text-[10px] text-slate-500 block mb-0.5">Rarity</label>
                                    <select 
                                      value={cItem.rarity}
                                      onChange={(e) => handleUpdateCardField(cItem.id, 'rarity', e.target.value)}
                                      className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-white"
                                    >
                                      {raritiesList.map(r => <option key={r} value={r}>{r}</option>)}
                                    </select>
                                  </div>

                                </div>

                                <div className="md:col-span-1 flex justify-end">
                                  <button 
                                    onClick={() => handleDeleteCardRow(cItem.id)}
                                    className="p-1.5 hover:bg-slate-800 text-slate-500 hover:text-rose-400 rounded transition-colors"
                                    title="Remove Card Row"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>

                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

              </div>
            )}

          </div>
        )}

      </div>

      {inspectedCard && (
        <InspectedCardModal
          card={inspectedCard}
          inventory={inventory}
          onUpdateQuantity={handleUpdateQuantity}
          onClose={() => setInspectedCard(null)}
        />
      )}

    </div>
  );
}