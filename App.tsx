
import React, { useState, useEffect } from 'react';
import { identifyAndCheckProduct, checkLatestBoycottNews, fetchMoreProducts, fetchMoreAlternatives } from './services/geminiService.ts';
import { AppState, ProductInfo, BoycottNews, Alternative } from './types.ts';
import CameraScanner from './components/CameraScanner.tsx';

const UPDATE_CHECK_INTERVAL_DAYS = 7;
const IMAGE_PLACEHOLDER = 'https://placehold.co/400x400/f8fafc/cbd5e1?text=%D9%84%D8%A7+%D8%AA%D9%88%D8%AC%D8%AF+%D8%B5%D9%88%D8%B1%D8%A9';

const getFlagEmoji = (country: string = '') => {
  const c = country.toLowerCase();
  if (c.includes('مصر') || c.includes('egypt')) return '🇪🇬';
  if (c.includes('سعودي') || c.includes('saudi')) return '🇸🇦';
  if (c.includes('تركي') || c.includes('turkey')) return '🇹🇷';
  if (c.includes('أردن') || c.includes('jordan')) return '🇯🇴';
  if (c.includes('إمارات') || c.includes('uae')) return '🇦🇪';
  if (c.includes('كويت') || c.includes('kuwait')) return '🇰🇼';
  if (c.includes('قطر') || c.includes('qatar')) return '🇶🇦';
  if (c.includes('عمان') || c.includes('oman')) return '🇴🇲';
  if (c.includes('بحرين') || c.includes('bahrain')) return '🇧🇭';
  if (c.includes('فلسطين') || c.includes('palestine')) return '🇵🇸';
  if (c.includes('لبنان') || c.includes('lebanon')) return '🇱🇧';
  if (c.includes('تونس') || c.includes('tunisia')) return '🇹🇳';
  if (c.includes('جزائر') || c.includes('algeria')) return '🇩🇿';
  if (c.includes('مغرب') || c.includes('morocco')) return '🇲🇦';
  if (c.includes('سوريا') || c.includes('syria')) return '🇸🇾';
  if (c.includes('محلي') || c.includes('local')) return '📍';
  return '🏳️';
};

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>(AppState.IDLE);
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<ProductInfo[] | null>(null);
  const [news, setNews] = useState<BoycottNews | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  
  const [favorites, setFavorites] = useState<Alternative[]>([]);
  const [customProducts, setCustomProducts] = useState<ProductInfo[]>([]);
  const [impactCount, setImpactCount] = useState(0);
  const [userLocation, setUserLocation] = useState<{ lat: number, lng: number } | undefined>(undefined);

  const [selectedProductDetail, setSelectedProductDetail] = useState<ProductInfo | null>(null);
  const [selectedAltDetail, setSelectedAltDetail] = useState<Alternative | null>(null);
  
  const [loadingMoreProducts, setLoadingMoreProducts] = useState(false);
  const [loadingMoreAltsFor, setLoadingMoreAltsFor] = useState<string | null>(null);

  const [newProductForm, setNewProductForm] = useState<Partial<ProductInfo>>({
    isBoycotted: true,
    alternatives: []
  });

  useEffect(() => {
    checkLastUpdateDate();
    const savedFavs = localStorage.getItem('badeelak_favs');
    if (savedFavs) setFavorites(JSON.parse(savedFavs));
    
    const savedImpact = localStorage.getItem('badeelak_impact');
    if (savedImpact) setImpactCount(parseInt(savedImpact));

    const savedCustom = localStorage.getItem('badeelak_custom_products');
    if (savedCustom) setCustomProducts(JSON.parse(savedCustom));

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        (err) => console.log('Location access denied or unavailable.', err)
      );
    }
  }, []);

  const getCurrentLocation = (): Promise<{ lat: number, lng: number } | undefined> => {
    return new Promise((resolve) => {
      if (userLocation) return resolve(userLocation);
      if (!navigator.geolocation) return resolve(undefined);
      
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setUserLocation(loc);
          resolve(loc);
        },
        () => resolve(undefined),
        { timeout: 5000 }
      );
    });
  };

  const checkLastUpdateDate = () => {
    const lastCheck = localStorage.getItem('last_boycott_update_check');
    const now = Date.now();
    if (!lastCheck) {
      localStorage.setItem('last_boycott_update_check', now.toString());
      return;
    }
  };

  const handleUpdateCheck = async () => {
    setAppState(AppState.SEARCHING);
    try {
      const newsData = await checkLatestBoycottNews();
      setNews(newsData);
      setAppState(AppState.NEWS);
    } catch (err) {
      setErrorMsg('تعذر تحميل التحديثات حالياً.');
      setAppState(AppState.ERROR);
    }
  };

  const handleSearch = async (queryToSearch: string = searchQuery, e?: React.FormEvent) => {
    e?.preventDefault();
    if (!queryToSearch.trim()) return;
    setAppState(AppState.SEARCHING);
    setCapturedImage(null);
    setErrorMsg(null);
    try {
      const location = await getCurrentLocation();
      const localMatches = customProducts.filter(p => 
        p.name.toLowerCase().includes(queryToSearch.toLowerCase()) || 
        p.brand.toLowerCase().includes(queryToSearch.toLowerCase())
      );

      const apiData = await identifyAndCheckProduct(queryToSearch, location);
      setResults([...localMatches, ...apiData]);
      setAppState(AppState.RESULT);
    } catch (err) {
      setErrorMsg('حدث خطأ أثناء البحث. حاول مرة أخرى.');
      setAppState(AppState.ERROR);
    }
  };

  const handleLoadMoreProducts = async () => {
    if (!searchQuery || loadingMoreProducts) return;
    setLoadingMoreProducts(true);
    try {
      const location = await getCurrentLocation();
      const more = await fetchMoreProducts(searchQuery, results?.length || 0, location);
      setResults(prev => prev ? [...prev, ...more] : more);
    } catch (err) {
      console.error("Error loading more products", err);
    } finally {
      setLoadingMoreProducts(false);
    }
  };

  const handleLoadMoreAlts = async (productIdx: number, brandName: string) => {
    if (loadingMoreAltsFor === brandName) return;
    setLoadingMoreAltsFor(brandName);
    try {
      const location = await getCurrentLocation();
      const more = await fetchMoreAlternatives(brandName, location);
      setResults(prev => {
        if (!prev) return null;
        const newResults = [...prev];
        const product = newResults[productIdx];
        const existingNames = new Set(product.alternatives.map(a => a.name));
        const filteredMore = more.filter(a => !existingNames.has(a.name));
        product.alternatives = [...product.alternatives, ...filteredMore];
        return newResults;
      });
    } catch (err) {
      console.error("Error loading more alternatives", err);
    } finally {
      setLoadingMoreAltsFor(null);
    }
  };

  const handleCapture = async (base64: string) => {
    setAppState(AppState.SEARCHING);
    setCapturedImage(`data:image/jpeg;base64,${base64}`);
    try {
      const location = await getCurrentLocation();
      const data = await identifyAndCheckProduct({ base64, mimeType: 'image/jpeg' }, location);
      setResults(data);
      setAppState(AppState.RESULT);
    } catch (err) {
      setErrorMsg('تعذر التعرف على المنتج. حاول كتابة اسمه.');
      setAppState(AppState.ERROR);
    }
  };

  const saveCustomProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProductForm.name || !newProductForm.brand) return;

    const fullProduct: ProductInfo = {
      name: newProductForm.name!,
      brand: newProductForm.brand!,
      category: newProductForm.category || 'عام',
      isBoycotted: newProductForm.isBoycotted ?? true,
      reason: newProductForm.reason || (newProductForm.isBoycotted ? 'تمت إضافته بواسطة المستخدم' : 'منتج آمن محلي'),
      imageUrl: 'https://placehold.co/400x400/f8fafc/cbd5e1?text=' + encodeURIComponent(newProductForm.brand!),
      alternatives: [],
      originCountry: newProductForm.originCountry || 'غير محدد',
      availabilityLocations: newProductForm.availabilityLocations || []
    };

    const updatedCustom = [...customProducts, fullProduct];
    setCustomProducts(updatedCustom);
    localStorage.setItem('badeelak_custom_products', JSON.stringify(updatedCustom));
    
    setNewProductForm({ isBoycotted: true, alternatives: [] });
    setResults([fullProduct]);
    setAppState(AppState.RESULT);
  };

  const toggleFavorite = (alt: Alternative) => {
    let newFavs;
    const exists = favorites.find(f => f.name === alt.name);
    if (exists) {
      newFavs = favorites.filter(f => f.name !== alt.name);
    } else {
      newFavs = [...favorites, alt];
    }
    setFavorites(newFavs);
    localStorage.setItem('badeelak_favs', JSON.stringify(newFavs));
  };

  const reset = () => {
    setAppState(AppState.IDLE);
    setSearchQuery('');
    setResults(null);
    setNews(null);
    setErrorMsg(null);
    setCapturedImage(null);
    setSelectedProductDetail(null);
    setSelectedAltDetail(null);
  };

  const shareInfo = async (text: string) => {
    if (navigator.share) {
      try {
        await navigator.share({ title: 'بديلك الأخلاقي', text: text });
      } catch (err) {
        console.debug('Sharing process was interrupted or canceled.');
      }
    } else {
      try {
        await navigator.clipboard.writeText(text);
      } catch (copyErr) {
        console.error('Copy to clipboard failed', copyErr);
      }
    }
  };

  const categories = [
    { name: 'مشروبات', icon: '🥤' },
    { name: 'ألبان وأجبان', icon: '🧀' },
    { name: 'منظفات', icon: '🧼' },
    { name: 'سناكس وحلويات', icon: '🍪' },
    { name: 'مطاعم', icon: '🍔' },
    { name: 'تكنولوجيا', icon: '💻' }
  ];

  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    e.currentTarget.src = IMAGE_PLACEHOLDER;
  };

  return (
    <div className="min-h-screen bg-[#FDFDFD] flex flex-col items-center pb-24 text-right" dir="rtl">
      <header className="w-full sticky top-0 z-40 bg-white/70 backdrop-blur-xl border-b border-slate-100 px-6 py-4 flex justify-center">
        <div className="w-full max-w-2xl flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer" onClick={reset}>
             <div className="w-10 h-10 bg-gradient-to-tr from-emerald-600 to-green-400 rounded-xl shadow-lg shadow-emerald-200 flex items-center justify-center text-white font-black text-xl">ب</div>
             <span className="text-xl font-black text-slate-800 tracking-tight mr-2">بديلك</span>
          </div>
          
          <div className="flex items-center gap-4">
             <div className="hidden sm:flex flex-col items-end">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">تأثيرك الأخلاقي</span>
                <span className="text-emerald-600 font-black">{impactCount} اختيار</span>
             </div>
             <div className="w-10 h-10 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 font-bold">
                {impactCount}
             </div>
          </div>
        </div>
      </header>

      <main className="w-full max-w-2xl px-5 py-8">
        {(appState === AppState.IDLE || appState === AppState.RESULT || appState === AppState.FAVORITES || appState === AppState.NEWS) && (
          <div className="relative mb-8 group">
            <form onSubmit={(e) => handleSearch(searchQuery, e)}>
              <input 
                type="text" 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ابحث عن ماركة أو منتج..."
                className="w-full h-16 pr-14 pl-6 rounded-2xl bg-white border border-slate-200 shadow-xl shadow-slate-100 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/5 outline-none transition-all text-lg text-slate-900 placeholder:text-slate-400 font-semibold"
              />
              <button type="submit" className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-emerald-500 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </button>
            </form>
          </div>
        )}

        {appState === AppState.IDLE && (
          <div className="space-y-12 animate-in fade-in duration-700">
            <section className="text-center">
              <h2 className="text-4xl font-black text-slate-900 mb-4 leading-tight">تسوق بوعي.. <br/><span className="text-emerald-600">ادعم اخوتك</span></h2>
              <p className="text-slate-500 text-lg max-w-md mx-auto">دليلك الذكي للتعرف على المنتجات المقاطعة وإيجاد أفضل البدائل المحلية والعربية.</p>
            </section>

            <section>
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-slate-800">تصفح الفئات</h3>
              </div>
              <div className="grid grid-cols-3 gap-4">
                {categories.map((cat) => (
                  <button 
                    key={cat.name}
                    onClick={() => {setSearchQuery(cat.name); handleSearch(cat.name);}}
                    className="flex flex-col items-center justify-center p-5 bg-white rounded-3xl border border-slate-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all group"
                  >
                    <span className="text-3xl mb-3 group-hover:scale-125 transition-transform duration-300">{cat.icon}</span>
                    <span className="text-slate-700 font-bold text-xs">{cat.name}</span>
                  </button>
                ))}
              </div>
            </section>
            
            <button 
              onClick={() => setAppState(AppState.ADD_PRODUCT)}
              className="w-full h-20 bg-emerald-50 border-2 border-dashed border-emerald-200 rounded-3xl flex items-center justify-center gap-3 text-emerald-700 font-black hover:bg-emerald-100 transition-all shadow-sm"
            >
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path></svg>
              أضف منتجاً غير موجود
            </button>
          </div>
        )}

        {appState === AppState.SEARCHING && (
          <div className="flex flex-col items-center justify-center py-20 animate-pulse">
            <div className="w-24 h-24 mb-6 relative">
               <div className="absolute inset-0 border-4 border-emerald-100 rounded-full"></div>
               <div className="absolute inset-0 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
            <h3 className="text-2xl font-black text-slate-800">جاري الاستعلام...</h3>
          </div>
        )}

        {appState === AppState.NEWS && news && (
          <div className="space-y-8 animate-in slide-in-from-bottom-8 duration-500">
             <div className="flex items-center justify-between">
                <h2 className="text-3xl font-black text-slate-900">أحدث المستجدات</h2>
                <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-3 py-1 rounded-full">تحديث: {news.lastUpdatedDate}</span>
             </div>

             <div className="bg-emerald-600 text-white p-8 rounded-[2.5rem] shadow-2xl shadow-emerald-200 relative overflow-hidden">
                <div className="relative z-10 space-y-4">
                   <h3 className="text-xl font-black flex items-center gap-2">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                      ملخص الموقف الحالي
                   </h3>
                   <p className="text-emerald-50 leading-relaxed font-bold">{news.summary}</p>
                </div>
                <div className="absolute -bottom-8 -left-8 w-32 h-32 bg-white/10 rounded-full blur-2xl"></div>
             </div>

             {news.recentAdditions.length > 0 && (
               <div className="space-y-4">
                  <h4 className="text-lg font-black text-slate-800 flex items-center gap-2">
                     <span className="w-2 h-8 bg-red-500 rounded-full"></span>
                     إضافات جديدة لقائمة المقاطعة
                  </h4>
                  <div className="grid gap-3">
                     {news.recentAdditions.map((item, idx) => (
                       <div key={idx} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-3">
                          <div className="w-10 h-10 bg-red-50 text-red-500 rounded-xl flex items-center justify-center font-black">!</div>
                          <span className="font-bold text-slate-800">{item}</span>
                       </div>
                     ))}
                  </div>
               </div>
             )}

             <button onClick={reset} className="w-full h-16 bg-slate-900 text-white font-black rounded-3xl shadow-xl hover:bg-black transition-all">العودة للرئيسية</button>
          </div>
        )}

        {appState === AppState.RESULT && results && (
          <div className="space-y-12 animate-in slide-in-from-bottom-8 duration-500">
            {results.length === 0 && (
              <div className="text-center py-10 space-y-6">
                 <div className="text-6xl">🔍</div>
                 <h3 className="text-2xl font-black text-slate-900">لم نجد نتائج مطابقة</h3>
                 <p className="text-slate-500">جرب البحث بكلمة أخرى، أو ساعدنا بإضافة المنتج.</p>
                 <button 
                  onClick={() => setAppState(AppState.ADD_PRODUCT)}
                  className="px-8 h-14 bg-emerald-600 text-white rounded-2xl font-bold shadow-lg"
                 >
                   إضافة منتج الآن
                 </button>
              </div>
            )}
            
            {results.map((product, pIdx) => (
              <div key={pIdx} className="space-y-6">
                <div 
                  onClick={() => setSelectedProductDetail(product)}
                  className={`relative cursor-pointer overflow-hidden rounded-[2.5rem] bg-white border border-slate-100 shadow-2xl transition-transform hover:scale-[1.01] active:scale-95 ${product.isBoycotted ? 'ring-2 ring-red-100' : 'ring-2 ring-emerald-100'}`}
                >
                  <div className="p-8">
                    <div className="flex flex-col md:flex-row gap-8">
                      <div className="w-full md:w-48 h-48 bg-slate-50 rounded-3xl overflow-hidden flex-shrink-0 border border-slate-100 p-4">
                        <img 
                          src={product.imageUrl} 
                          alt={product.name}
                          className="w-full h-full object-contain"
                          onError={handleImageError}
                        />
                      </div>
                      <div className="flex-1 space-y-4">
                        <div className="flex items-center gap-3">
                          <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${product.isBoycotted ? 'bg-red-500 text-white shadow-lg shadow-red-200' : 'bg-emerald-500 text-white shadow-lg shadow-emerald-200'}`}>
                            {product.isBoycotted ? 'منتج مقاطع' : 'منتج آمن'}
                          </span>
                        </div>
                        <h2 className="text-3xl font-black text-slate-900 leading-tight">{product.brand}</h2>
                        <p className="text-slate-600 font-bold">{product.name}</p>
                        <p className="text-xs text-emerald-600 font-black">إضغط للتفاصيل 👆</p>
                      </div>
                    </div>
                  </div>
                </div>

                {product.alternatives.length > 0 && (
                  <div className="space-y-4 px-2">
                     <h3 className="text-xl font-black text-slate-800 flex items-center gap-2">
                        بـدائـل مقتـرحة لـ {product.brand}
                        <span className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 text-[10px]">{product.alternatives.length}</span>
                     </h3>
                     <div className="grid gap-4">
                        {product.alternatives.map((alt, i) => (
                          <div 
                            key={i} 
                            className="bg-white rounded-[2rem] p-4 border border-slate-100 shadow-sm hover:shadow-xl transition-all flex gap-4 cursor-pointer"
                            onClick={() => setSelectedAltDetail(alt)}
                          >
                             <div className="w-24 h-24 bg-slate-50 rounded-2xl overflow-hidden flex-shrink-0 p-2">
                                <img 
                                  src={alt.imageUrl} 
                                  alt={alt.name} 
                                  className="w-full h-full object-contain"
                                  onError={handleImageError}
                                />
                             </div>
                             <div className="flex-1 space-y-2">
                                <div className="flex justify-between items-start">
                                   <div className="space-y-1">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <h4 className="font-black text-slate-900">{alt.name}</h4>
                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-100 text-[10px] font-bold text-emerald-700">
                                          <span>{getFlagEmoji(alt.origin)}</span>
                                          <span>{alt.origin}</span>
                                        </span>
                                      </div>
                                      <p className="text-[10px] text-slate-500 font-bold">{alt.manufacturer}</p>
                                   </div>
                                   <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                                      {alt.websiteUrl && (
                                        <a href={alt.websiteUrl} target="_blank" rel="noopener noreferrer" className="p-2 rounded-xl bg-blue-50 text-blue-500 hover:bg-blue-100 transition-colors">
                                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg>
                                        </a>
                                      )}
                                      {alt.mapsUrl && (
                                        <a href={alt.mapsUrl} target="_blank" rel="noopener noreferrer" className="p-2 rounded-xl bg-amber-50 text-amber-500 hover:bg-amber-100 transition-colors relative group">
                                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                                          {userLocation && <span className="absolute -top-1 -right-1 w-2 h-2 bg-emerald-500 rounded-full border border-white"></span>}
                                        </a>
                                      )}
                                      <button onClick={() => toggleFavorite(alt)} className={`p-2 rounded-xl transition-colors ${favorites.find(f => f.name === alt.name) ? 'bg-rose-50 text-rose-500' : 'bg-slate-50 text-slate-400'}`}>
                                         <svg className="w-4 h-4" fill={favorites.find(f => f.name === alt.name) ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"></path></svg>
                                      </button>
                                   </div>
                                </div>
                             </div>
                          </div>
                        ))}
                     </div>
                     <button 
                      onClick={() => handleLoadMoreAlts(pIdx, product.brand)}
                      disabled={loadingMoreAltsFor === product.brand}
                      className="w-full py-3 text-emerald-600 font-black text-sm border-2 border-dashed border-emerald-100 rounded-2xl hover:bg-emerald-50 transition-all flex items-center justify-center gap-2"
                     >
                        {loadingMoreAltsFor === product.brand ? (
                          <span className="w-4 h-4 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin"></span>
                        ) : (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19 9l-7 7-7-7"></path></svg>
                        )}
                        مشاهدة بدائل إضافية لـ {product.brand}
                     </button>
                  </div>
                )}
                <div className="border-b border-slate-100 pt-8"></div>
              </div>
            ))}
            
            {results.length > 0 && (
              <div className="space-y-4">
                <button 
                  onClick={handleLoadMoreProducts}
                  disabled={loadingMoreProducts}
                  className="w-full h-16 bg-white border-2 border-slate-200 text-slate-700 font-black rounded-3xl hover:border-emerald-500 hover:text-emerald-600 transition-all flex items-center justify-center gap-3"
                >
                  {loadingMoreProducts ? (
                    <span className="w-6 h-6 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></span>
                  ) : (
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19 9l-7 7-7-7"></path></svg>
                  )}
                  مشاهدة ماركات مقاطعة إضافية
                </button>
                <button 
                  onClick={() => setAppState(AppState.ADD_PRODUCT)}
                  className="w-full py-4 text-emerald-600 font-bold border border-emerald-100 rounded-2xl hover:bg-emerald-50 transition-colors"
                >
                  لم تجد منتجاً معيناً؟ أضفه هنا
                </button>
              </div>
            )}
            
            <button onClick={reset} className="w-full h-16 bg-slate-900 text-white font-black rounded-3xl shadow-2xl hover:bg-black transition-all">بحث جديد</button>
          </div>
        )}

        {appState === AppState.ADD_PRODUCT && (
          <div className="animate-in slide-in-from-bottom-10 duration-500 space-y-8">
             <div className="flex items-center gap-4">
                <button onClick={reset} className="p-3 bg-slate-100 rounded-2xl text-slate-500 shadow-sm">
                   <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                </button>
                <h2 className="text-3xl font-black text-slate-900">إضافة منتج جديد</h2>
             </div>

             <form onSubmit={saveCustomProduct} className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-2xl space-y-6">
                <div>
                   <label className="block text-sm font-bold text-slate-500 mb-2">اسم الماركة / الشركة</label>
                   <input 
                    required
                    type="text" 
                    placeholder="مثال: كوكاكولا، شركة س"
                    className="w-full h-14 bg-slate-50 border border-slate-200 rounded-2xl px-5 focus:ring-2 focus:ring-emerald-500 outline-none text-slate-900 font-bold text-lg"
                    value={newProductForm.brand || ''}
                    onChange={e => setNewProductForm({...newProductForm, brand: e.target.value})}
                   />
                </div>
                <div>
                   <label className="block text-sm font-bold text-slate-500 mb-2">اسم المنتج</label>
                   <input 
                    required
                    type="text" 
                    placeholder="مثال: مشروب غازي 250مل"
                    className="w-full h-14 bg-slate-50 border border-slate-200 rounded-2xl px-5 focus:ring-2 focus:ring-emerald-500 outline-none text-slate-900 font-bold text-lg"
                    value={newProductForm.name || ''}
                    onChange={e => setNewProductForm({...newProductForm, name: e.target.value})}
                   />
                </div>
                
                <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-3xl border border-slate-100">
                   <span className="flex-1 font-black text-slate-800">هل المنتج مقاطع؟</span>
                   <button 
                    type="button"
                    onClick={() => setNewProductForm({...newProductForm, isBoycotted: !newProductForm.isBoycotted})}
                    className={`h-12 px-8 rounded-2xl font-black transition-all shadow-md ${newProductForm.isBoycotted ? 'bg-red-500 text-white' : 'bg-emerald-500 text-white'}`}
                   >
                     {newProductForm.isBoycotted ? 'نعم (مقاطع)' : 'لا (آمن)'}
                   </button>
                </div>

                {newProductForm.isBoycotted && (
                  <div>
                     <label className="block text-sm font-bold text-slate-500 mb-2">سبب المقاطعة</label>
                     <textarea 
                      placeholder="اشرح باختصار سبب الموقف من هذا المنتج..."
                      className="w-full h-32 bg-slate-50 border border-slate-200 rounded-2xl p-5 focus:ring-2 focus:ring-emerald-500 outline-none resize-none text-slate-900 font-medium leading-relaxed"
                      value={newProductForm.reason || ''}
                      onChange={e => setNewProductForm({...newProductForm, reason: e.target.value})}
                     />
                  </div>
                )}

                <button type="submit" className="w-full h-16 bg-emerald-600 text-white font-black rounded-3xl shadow-xl shadow-emerald-100 hover:bg-emerald-700 transition-all active:scale-95">
                  حفظ المنتج في قائمتي
                </button>
             </form>
          </div>
        )}

        {appState === AppState.FAVORITES && (
          <div className="space-y-6 animate-in fade-in duration-500">
             <h2 className="text-3xl font-black text-slate-900 px-2">مفضلتي الأخلاقية</h2>
             {favorites.length > 0 ? (
               <div className="grid gap-4">
                 {favorites.map((fav, i) => (
                    <div key={i} className="bg-white p-5 rounded-3xl border border-slate-100 flex items-center gap-5 shadow-sm cursor-pointer" onClick={() => setSelectedAltDetail(fav)}>
                       <div className="w-20 h-20 bg-slate-50 rounded-2xl p-2 flex-shrink-0">
                          <img 
                            src={fav.imageUrl} 
                            alt={fav.name} 
                            className="w-full h-full object-contain"
                            onError={handleImageError}
                          />
                       </div>
                       <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <h4 className="font-bold text-slate-900">{fav.name}</h4>
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-100 text-[9px] font-bold text-emerald-700">
                              <span>{getFlagEmoji(fav.origin)}</span>
                              <span>{fav.origin}</span>
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-500 font-bold">{fav.manufacturer}</span>
                       </div>
                       <div className="flex gap-1">
                          {fav.websiteUrl && (
                            <a href={fav.websiteUrl} target="_blank" rel="noopener noreferrer" className="p-2 text-blue-500">
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg>
                            </a>
                          )}
                          <button onClick={(e) => { e.stopPropagation(); toggleFavorite(fav); }} className="text-rose-500 p-2">
                             <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd"></path></svg>
                          </button>
                       </div>
                    </div>
                 ))}
               </div>
             ) : (
               <p className="text-center py-20 text-slate-400 font-bold">لم تضف أي بدائل بعد.</p>
             )}
          </div>
        )}

        {appState === AppState.ERROR && (
           <div className="text-center py-20 space-y-6">
              <h3 className="text-2xl font-black text-slate-900">{errorMsg}</h3>
              <button onClick={reset} className="px-8 h-14 bg-emerald-600 text-white rounded-2xl font-bold shadow-lg">العودة للرئيسية</button>
           </div>
        )}
      </main>

      {(selectedProductDetail || selectedAltDetail) && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-300">
           <div className="w-full max-w-lg bg-white rounded-[3rem] overflow-hidden shadow-2xl max-h-[90vh] overflow-y-auto relative text-right" dir="rtl">
              <button onClick={() => { setSelectedProductDetail(null); setSelectedAltDetail(null); }} className="absolute top-6 left-6 z-10 p-3 bg-white/80 backdrop-blur rounded-2xl text-slate-500 shadow-xl">
                 <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
              </button>

              <div className="p-8 space-y-6">
                {selectedProductDetail && (
                  <>
                    <div className="w-48 h-48 mx-auto bg-slate-50 rounded-[2.5rem] p-4 border border-slate-100">
                       <img 
                        src={selectedProductDetail.imageUrl} 
                        className="w-full h-full object-contain"
                        onError={handleImageError}
                       />
                    </div>
                    <div className="text-center space-y-3">
                       <span className={`px-4 py-1 rounded-full text-[10px] font-black uppercase ${selectedProductDetail.isBoycotted ? 'bg-red-500 text-white' : 'bg-emerald-500 text-white'}`}>
                          {selectedProductDetail.isBoycotted ? 'منتج مقاطع' : 'منتج آمن'}
                       </span>
                       <h3 className="text-3xl font-black text-slate-900">{selectedProductDetail.brand}</h3>
                       <p className="text-slate-600 font-bold">{selectedProductDetail.name}</p>
                       {selectedProductDetail.originCountry && (
                          <div className="flex justify-center">
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 border border-slate-200 text-xs font-bold text-slate-700">
                              <span>بلد المنشأ: {selectedProductDetail.originCountry}</span>
                            </span>
                          </div>
                       )}
                    </div>
                    <div className="p-6 bg-rose-50/50 rounded-3xl border border-rose-100">
                       <h5 className="text-rose-700 font-black mb-2">الموقف الأخلاقي:</h5>
                       <p className="text-sm text-slate-700 leading-relaxed font-medium">{selectedProductDetail.reason}</p>
                    </div>
                  </>
                )}

                {selectedAltDetail && (
                  <>
                    <div className="w-48 h-48 mx-auto bg-slate-50 rounded-[2.5rem] p-4 border border-slate-100">
                       <img 
                        src={selectedAltDetail.imageUrl} 
                        className="w-full h-full object-contain"
                        onError={handleImageError}
                       />
                    </div>
                    <div className="text-center space-y-3">
                       <span className="px-4 py-1 rounded-full text-[10px] font-black uppercase bg-emerald-500 text-white">بديـل آمـن</span>
                       <h3 className="text-3xl font-black text-slate-900">{selectedAltDetail.name}</h3>
                       <div className="flex flex-col items-center gap-2">
                         <p className="text-emerald-600 font-bold">{selectedAltDetail.manufacturer}</p>
                         <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-100 text-xs font-bold text-emerald-700">
                            <span>{getFlagEmoji(selectedAltDetail.origin)}</span>
                            <span>صنع في {selectedAltDetail.origin}</span>
                         </span>
                       </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      {selectedAltDetail.websiteUrl && (
                        <a 
                          href={selectedAltDetail.websiteUrl} 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          className="flex items-center justify-center gap-2 h-14 bg-blue-600 text-white font-bold rounded-2xl shadow-lg shadow-blue-100"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9h18"></path></svg>
                          الموقع الرسمي
                        </a>
                      )}
                      {selectedAltDetail.mapsUrl && (
                        <a 
                          href={selectedAltDetail.mapsUrl} 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          className="flex items-center justify-center gap-2 h-14 bg-amber-600 text-white font-bold rounded-2xl shadow-lg shadow-amber-100"
                        >
                          <div className="relative">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                            {userLocation && <span className="absolute -top-1 -right-1 w-2 h-2 bg-emerald-300 rounded-full animate-ping"></span>}
                          </div>
                          {userLocation ? 'الموقع الأقرب' : 'خرائط جوجل'}
                        </a>
                      )}
                    </div>

                    <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100">
                       <h5 className="text-slate-800 font-black mb-2">لماذا هذا البديل؟</h5>
                       <p className="text-sm text-slate-700 leading-relaxed font-medium">{selectedAltDetail.description}</p>
                    </div>
                  </>
                )}
              </div>
           </div>
        </div>
      )}

      <nav className="fixed bottom-0 left-0 right-0 z-50 flex justify-center p-4">
         <div className="w-full max-w-md bg-white/80 backdrop-blur-2xl border border-slate-200 shadow-xl rounded-[2.5rem] p-3 flex items-center justify-around">
            <button onClick={reset} className={`flex flex-col items-center gap-1 p-2 transition-all ${appState === AppState.IDLE ? 'text-emerald-600 scale-110' : 'text-slate-400'}`}>
               <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"></path></svg>
               <span className="text-[10px] font-black">الرئيسية</span>
            </button>
            <button onClick={() => setAppState(AppState.FAVORITES)} className={`flex flex-col items-center gap-1 p-2 transition-all ${appState === AppState.FAVORITES ? 'text-emerald-600 scale-110' : 'text-slate-400'}`}>
               <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"></path></svg>
               <span className="text-[10px] font-black">مفضلتي</span>
            </button>
            <button onClick={() => setAppState(AppState.SCANNING)} className="relative -top-10 w-20 h-20 bg-gradient-to-tr from-emerald-600 to-green-400 rounded-full shadow-2xl border-[6px] border-[#FDFDFD] flex items-center justify-center text-white">
               <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
            </button>
            <button onClick={handleUpdateCheck} className={`flex flex-col items-center gap-1 p-2 transition-all ${appState === AppState.NEWS ? 'text-emerald-600 scale-110' : 'text-slate-400'}`}>
               <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10l4 4v10a2 2 0 01-2 2z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 4v5h5"></path></svg>
               <span className="text-[10px] font-black">أخبار</span>
            </button>
            <button onClick={() => shareInfo('استخدم بديلك الآن!')} className="flex flex-col items-center gap-1 p-2 text-slate-400">
               <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 100-5.368 3 3 0 000 5.368zm0 7.105a3 3 0 100 5.368 3 3 0 000-5.368z"></path></svg>
               <span className="text-[10px] font-black">مشاركة</span>
            </button>
         </div>
      </nav>

      {appState === AppState.SCANNING && (
        <CameraScanner onCapture={handleCapture} onClose={() => setAppState(AppState.IDLE)} />
      )}
    </div>
  );
};

export default App;
