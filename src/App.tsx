import React, { useState, useRef, ChangeEvent, useEffect } from 'react';
import { Upload, Image as ImageIcon, Settings, Download, Trash2, Layers, CheckCircle2, RefreshCw, FolderUp, FileUp, Plus, AlignVerticalJustifyStart, AlignVerticalJustifyCenter, AlignVerticalJustifyEnd } from 'lucide-react';
import JSZip from 'jszip';

interface BaseProduct {
  id: string;
  url: string;
  name: string;
  printArea: { x: number; y: number; width: number; height: number };
  align: 'top' | 'center' | 'bottom';
  dimensions: { w: number; h: number };
}

interface Design {
  id: string;
  url: string;
  name: string;
  category: string;
}

export default function App() {
  const [step, setStep] = useState(1);
  
  // Base Products State
  const [baseProducts, setBaseProducts] = useState<BaseProduct[]>([]);
  const [activeBaseProductId, setActiveBaseProductId] = useState<string | null>(null);
  
  // Designs State
  const [designs, setDesigns] = useState<Design[]>([]);
  
  // Output Config State
  const [outputConfig, setOutputConfig] = useState({
    pattern: '{base}-{design}',
    prefix: '',
    suffix: ''
  });
  
  // Generation State
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

  // Cleanup object URLs on unmount
  useEffect(() => {
    return () => {
      baseProducts.forEach(p => URL.revokeObjectURL(p.url));
      designs.forEach(d => URL.revokeObjectURL(d.url));
      if (downloadUrl) URL.revokeObjectURL(downloadUrl);
    };
  }, []);

  const handleBaseImageUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    
    Array.from(files).forEach(file => {
      if (!file.type.startsWith('image/')) return;
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        const newProduct: BaseProduct = {
          id: Math.random().toString(36).substring(7),
          url,
          name: file.name,
          printArea: { x: 25, y: 25, width: 50, height: 50 },
          align: 'top',
          dimensions: { w: img.width, h: img.height }
        };
        setBaseProducts(prev => {
          const updated = [...prev, newProduct];
          if (updated.length === 1) setActiveBaseProductId(newProduct.id);
          return updated;
        });
      };
      img.src = url;
    });
    
    // Reset input
    e.target.value = '';
  };

  const removeBaseProduct = (id: string) => {
    const product = baseProducts.find(p => p.id === id);
    if (product) URL.revokeObjectURL(product.url);
    
    setBaseProducts(prev => {
      const updated = prev.filter(p => p.id !== id);
      if (activeBaseProductId === id) {
        setActiveBaseProductId(updated.length > 0 ? updated[0].id : null);
      }
      return updated;
    });
  };

  const updateActiveBaseProduct = (updates: Partial<BaseProduct>) => {
    setBaseProducts(prev => prev.map(p => p.id === activeBaseProductId ? { ...p, ...updates } : p));
  };

  const handleDesignsUpload = (e: ChangeEvent<HTMLInputElement>, isFolder: boolean) => {
    const files = e.target.files;
    if (!files) return;
    
    const newDesigns: Design[] = [];
    Array.from(files).forEach(file => {
      if (!file.type.startsWith('image/')) return;
      const url = URL.createObjectURL(file);
      
      let category = 'Uncategorized';
      if (isFolder && file.webkitRelativePath) {
         const parts = file.webkitRelativePath.split('/');
         if (parts.length > 1) {
           category = parts[parts.length - 2]; // Parent folder name
         }
      }
      
      newDesigns.push({
        id: Math.random().toString(36).substring(7),
        url,
        name: file.name,
        category
      });
    });
    
    setDesigns(prev => [...prev, ...newDesigns]);
    
    // Reset input
    e.target.value = '';
  };

  const removeDesign = (id: string) => {
    const design = designs.find(d => d.id === id);
    if (design) URL.revokeObjectURL(design.url);
    setDesigns(prev => prev.filter(d => d.id !== id));
  };

  const generateZip = async () => {
    if (baseProducts.length === 0 || designs.length === 0) return;
    
    setIsGenerating(true);
    setProgress({ current: 0, total: baseProducts.length * designs.length });
    
    const zip = new JSZip();
    
    for (const base of baseProducts) {
      const baseImg = new Image();
      baseImg.src = base.url;
      await new Promise(r => { baseImg.onload = r; });
      
      const canvas = document.createElement('canvas');
      canvas.width = base.dimensions.w;
      canvas.height = base.dimensions.h;
      const ctx = canvas.getContext('2d');
      if (!ctx) continue;
      
      const pxX = (base.printArea.x / 100) * canvas.width;
      const pxY = (base.printArea.y / 100) * canvas.height;
      const pxW = (base.printArea.width / 100) * canvas.width;
      const pxH = (base.printArea.height / 100) * canvas.height;
      
      for (const design of designs) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(baseImg, 0, 0);
        
        const designImg = new Image();
        designImg.src = design.url;
        await new Promise(r => { designImg.onload = r; });
        
        const scale = Math.min(pxW / designImg.width, pxH / designImg.height);
        const scaledW = designImg.width * scale;
        const scaledH = designImg.height * scale;
        
        const drawX = pxX + (pxW - scaledW) / 2;
        let drawY = pxY;
        if (base.align === 'center') drawY = pxY + (pxH - scaledH) / 2;
        else if (base.align === 'bottom') drawY = pxY + pxH - scaledH;
        
        ctx.drawImage(designImg, drawX, drawY, scaledW, scaledH);
        
        const blob = await new Promise<Blob | null>(r => canvas.toBlob(r, 'image/png'));
        if (blob) {
           const baseName = base.name.replace(/\.[^/.]+$/, "");
           const designName = design.name.replace(/\.[^/.]+$/, "");
           
           let fileName = outputConfig.pattern
              .replace(/{base}/g, baseName)
              .replace(/{design}/g, designName)
              .replace(/{category}/g, design.category);
              
           fileName = `${outputConfig.prefix}${fileName}${outputConfig.suffix}.png`;
           
           // Structure: Category / Base Product Name / Output Files
           zip.folder(design.category)?.folder(baseName)?.file(fileName, blob);
        }
        setProgress(p => ({ ...p, current: p.current + 1 }));
      }
    }
    
    const zipBlob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(zipBlob);
    setDownloadUrl(url);
    
    // Auto-download
    const link = document.createElement('a');
    link.href = url;
    link.download = 'mockups.zip';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    setIsGenerating(false);
    setStep(5);
  };

  const activeBaseProduct = baseProducts.find(p => p.id === activeBaseProductId);
  
  // Group designs by category
  const groupedDesigns = designs.reduce((acc, design) => {
    if (!acc[design.category]) acc[design.category] = [];
    acc[design.category].push(design);
    return acc;
  }, {} as Record<string, Design[]>);

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans flex flex-col">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between sticky top-0 z-10 shrink-0">
        <div className="flex items-center gap-2">
          <Layers className="w-6 h-6 text-indigo-600" />
          <h1 className="text-xl font-bold tracking-tight">Batch Mockup Generator</h1>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto p-6 flex flex-col md:flex-row gap-8">
        
        {/* Sidebar / Stepper */}
        <div className="w-full md:w-64 shrink-0">
          <nav className="space-y-2 sticky top-24">
            {[
              { num: 1, label: 'Base Products', icon: ImageIcon },
              { num: 2, label: 'Designs', icon: Upload },
              { num: 3, label: 'Output Settings', icon: Settings },
              { num: 4, label: 'Generate', icon: CheckCircle2 },
            ].map((s) => (
              <button
                key={s.num}
                onClick={() => {
                  if (s.num <= step || (s.num === 2 && baseProducts.length > 0) || (s.num === 3 && baseProducts.length > 0 && designs.length > 0)) {
                    setStep(s.num);
                  }
                }}
                disabled={s.num > step && !(s.num === 2 && baseProducts.length > 0) && !(s.num === 3 && baseProducts.length > 0 && designs.length > 0)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-colors ${
                  step === s.num
                    ? 'bg-indigo-50 text-indigo-700 font-medium'
                    : s.num < step
                    ? 'text-gray-600 hover:bg-gray-100'
                    : 'text-gray-400 cursor-not-allowed'
                }`}
              >
                <s.icon className={`w-5 h-5 ${step === s.num ? 'text-indigo-600' : ''}`} />
                <span>{s.num}. {s.label}</span>
              </button>
            ))}
          </nav>
        </div>

        {/* Content Area */}
        <div className="flex-1 bg-white rounded-2xl shadow-sm border border-gray-200 p-6 min-h-[600px] flex flex-col">
          
          {/* STEP 1: BASE PRODUCTS */}
          {step === 1 && (
            <div className="h-full flex flex-col">
              <div className="flex justify-between items-end mb-6">
                <div>
                  <h2 className="text-xl font-bold mb-1">Base Products</h2>
                  <p className="text-sm text-gray-500">Upload multiple base products and configure their print areas.</p>
                </div>
                <label className="cursor-pointer bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium transition-colors shadow-sm inline-flex items-center gap-2">
                  <Plus className="w-4 h-4" />
                  Add Base Product
                  <input type="file" accept="image/*" multiple className="hidden" onChange={handleBaseImageUpload} />
                </label>
              </div>

              {baseProducts.length === 0 ? (
                <div className="flex-1 border-2 border-dashed border-gray-300 rounded-xl flex flex-col items-center justify-center text-gray-400">
                  <ImageIcon className="w-12 h-12 mb-4 text-gray-300" />
                  <p>No base products uploaded yet.</p>
                </div>
              ) : (
                <div className="flex-1 flex flex-col lg:flex-row gap-6 min-h-0">
                  {/* Product List */}
                  <div className="w-full lg:w-64 flex flex-col gap-3 overflow-y-auto pr-2">
                    {baseProducts.map(product => (
                      <div 
                        key={product.id}
                        onClick={() => setActiveBaseProductId(product.id)}
                        className={`relative group flex items-center gap-3 p-2 rounded-xl border cursor-pointer transition-all ${
                          activeBaseProductId === product.id 
                            ? 'border-indigo-500 bg-indigo-50 ring-1 ring-indigo-500' 
                            : 'border-gray-200 hover:border-indigo-300 hover:bg-gray-50'
                        }`}
                      >
                        <img src={product.url} alt={product.name} className="w-12 h-12 object-contain bg-white rounded-lg border border-gray-200" />
                        <span className="text-sm font-medium truncate flex-1" title={product.name}>{product.name}</span>
                        <button 
                          onClick={(e) => { e.stopPropagation(); removeBaseProduct(product.id); }}
                          className="opacity-0 group-hover:opacity-100 p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-all"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* Active Product Config */}
                  {activeBaseProduct && (
                    <div className="flex-1 flex flex-col xl:flex-row gap-6 bg-gray-50 p-4 rounded-xl border border-gray-200 overflow-y-auto">
                      
                      {/* Configuration Controls */}
                      <div className="w-full xl:w-64 shrink-0 space-y-6">
                        <div>
                          <h3 className="font-bold text-gray-900 mb-4">Print Area</h3>
                          <div className="space-y-4">
                            {['x', 'y', 'width', 'height'].map((axis) => (
                              <div key={axis}>
                                <label className="flex justify-between text-xs font-medium text-gray-700 mb-1 uppercase">
                                  <span>{axis}</span>
                                  <span>{activeBaseProduct.printArea[axis as keyof typeof activeBaseProduct.printArea]}%</span>
                                </label>
                                <input 
                                  type="range" min="0" max="100" 
                                  value={activeBaseProduct.printArea[axis as keyof typeof activeBaseProduct.printArea]}
                                  onChange={(e) => updateActiveBaseProduct({ 
                                    printArea: { ...activeBaseProduct.printArea, [axis]: Number(e.target.value) } 
                                  })}
                                  className="w-full accent-indigo-600"
                                />
                              </div>
                            ))}
                          </div>
                        </div>

                        <div>
                          <h3 className="font-bold text-gray-900 mb-3">Vertical Alignment</h3>
                          <div className="flex bg-white border border-gray-200 rounded-lg overflow-hidden p-1 gap-1">
                            {[
                              { id: 'top', label: 'Top', icon: AlignVerticalJustifyStart },
                              { id: 'center', label: 'Center', icon: AlignVerticalJustifyCenter },
                              { id: 'bottom', label: 'Bottom', icon: AlignVerticalJustifyEnd },
                            ].map(align => (
                              <button
                                key={align.id}
                                onClick={() => updateActiveBaseProduct({ align: align.id as 'top'|'center'|'bottom' })}
                                className={`flex-1 flex flex-col items-center justify-center py-2 rounded-md text-xs font-medium transition-colors ${
                                  activeBaseProduct.align === align.id 
                                    ? 'bg-indigo-100 text-indigo-700' 
                                    : 'text-gray-500 hover:bg-gray-50'
                                }`}
                              >
                                <align.icon className="w-4 h-4 mb-1" />
                                {align.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Preview Box */}
                      <div className="flex-1 flex items-center justify-center bg-gray-200/50 rounded-xl border border-gray-300 overflow-hidden p-4 min-h-[300px]">
                        <div className="relative max-w-full max-h-full shadow-sm">
                          <img src={activeBaseProduct.url} alt="Base Preview" className="max-w-full max-h-[500px] object-contain block" />
                          <div 
                            className="absolute border-2 border-indigo-500 bg-indigo-500/20 shadow-[0_0_0_9999px_rgba(0,0,0,0.4)]"
                            style={{
                              left: `${activeBaseProduct.printArea.x}%`,
                              top: `${activeBaseProduct.printArea.y}%`,
                              width: `${activeBaseProduct.printArea.width}%`,
                              height: `${activeBaseProduct.printArea.height}%`,
                            }}
                          >
                            <div className="absolute inset-0 flex items-center justify-center text-indigo-700 font-bold text-sm drop-shadow-md opacity-50 text-center px-2">
                              PRINT AREA<br/>({activeBaseProduct.align.toUpperCase()})
                            </div>
                          </div>
                        </div>
                      </div>

                    </div>
                  )}
                </div>
              )}

              <div className="mt-6 pt-6 border-t border-gray-100 flex justify-end">
                <button 
                  onClick={() => setStep(2)}
                  disabled={baseProducts.length === 0}
                  className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white px-8 py-3 rounded-xl font-medium transition-colors shadow-sm"
                >
                  Continue to Designs
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: DESIGNS */}
          {step === 2 && (
            <div className="h-full flex flex-col">
              <div className="flex justify-between items-end mb-6">
                <div>
                  <h2 className="text-xl font-bold mb-1">Upload Designs</h2>
                  <p className="text-sm text-gray-500">Upload folders (categories) or individual transparent PNG designs.</p>
                </div>
                <div className="flex gap-3">
                  <label className="cursor-pointer bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 px-4 py-2 rounded-lg font-medium transition-colors inline-flex items-center gap-2">
                    <FileUp className="w-4 h-4" />
                    Add Files
                    <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => handleDesignsUpload(e, false)} />
                  </label>
                  <label className="cursor-pointer bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 text-indigo-700 px-4 py-2 rounded-lg font-medium transition-colors inline-flex items-center gap-2">
                    <FolderUp className="w-4 h-4" />
                    Add Folder
                    <input 
                      type="file" 
                      accept="image/*" 
                      multiple 
                      // @ts-expect-error webkitdirectory is non-standard but widely supported
                      webkitdirectory="true" 
                      directory="true" 
                      className="hidden" 
                      onChange={(e) => handleDesignsUpload(e, true)} 
                    />
                  </label>
                </div>
              </div>

              {designs.length === 0 ? (
                <div className="flex-1 border-2 border-dashed border-gray-300 rounded-xl flex flex-col items-center justify-center text-gray-400">
                  <Upload className="w-12 h-12 mb-4 text-gray-300" />
                  <p>No designs uploaded yet.</p>
                </div>
              ) : (
                <div className="flex-1 overflow-y-auto pr-2 space-y-8">
                  {Object.entries(groupedDesigns).map(([category, catDesigns]) => (
                    <div key={category}>
                      <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2 border-b border-gray-200 pb-2">
                        <FolderUp className="w-5 h-5 text-indigo-500" />
                        {category} <span className="text-gray-400 text-sm font-normal">({catDesigns.length} designs)</span>
                      </h3>
                      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-4">
                        {catDesigns.map((design) => (
                          <div key={design.id} className="group relative bg-gray-50 border border-gray-200 rounded-xl p-2 flex flex-col items-center">
                            <div className="w-full aspect-square flex items-center justify-center bg-white rounded-lg mb-2 overflow-hidden">
                              <img src={design.url} alt={design.name} className="max-w-full max-h-full object-contain" />
                            </div>
                            <p className="text-xs text-gray-500 truncate w-full text-center px-1" title={design.name}>
                              {design.name}
                            </p>
                            <button 
                              onClick={() => removeDesign(design.id)}
                              className="absolute -top-2 -right-2 bg-red-500 text-white p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-sm hover:bg-red-600"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-6 pt-6 border-t border-gray-100 flex justify-end">
                <button 
                  onClick={() => setStep(3)}
                  disabled={designs.length === 0}
                  className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white px-8 py-3 rounded-xl font-medium transition-colors shadow-sm"
                >
                  Continue to Output Settings
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: OUTPUT SETTINGS */}
          {step === 3 && (
            <div className="h-full flex flex-col">
              <div className="mb-6">
                <h2 className="text-xl font-bold mb-1">Output Settings</h2>
                <p className="text-sm text-gray-500">Configure how your generated files will be named and structured.</p>
              </div>

              <div className="flex-1">
                <div className="max-w-2xl space-y-8">
                  
                  {/* Structure Preview */}
                  <div className="bg-gray-50 p-6 rounded-xl border border-gray-200">
                    <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                      <Layers className="w-5 h-5 text-indigo-500" />
                      ZIP Folder Structure
                    </h3>
                    <div className="font-mono text-sm text-gray-700 bg-white p-4 rounded-lg border border-gray-200">
                      <div>📁 mockups.zip</div>
                      <div className="ml-4">📁 [Category Name] <span className="text-gray-400 italic">(e.g., Summer Collection)</span></div>
                      <div className="ml-8">📁 [Base Product Name] <span className="text-gray-400 italic">(e.g., White T-Shirt)</span></div>
                      <div className="ml-12 text-indigo-600 font-medium">📄 [Generated Filename].png</div>
                    </div>
                  </div>

                  {/* Filename Config */}
                  <div className="space-y-4">
                    <h3 className="font-bold text-gray-900">Filename Configuration</h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Prefix</label>
                        <input 
                          type="text" 
                          value={outputConfig.prefix}
                          onChange={(e) => setOutputConfig({...outputConfig, prefix: e.target.value})}
                          placeholder="e.g., final_"
                          className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Pattern</label>
                        <input 
                          type="text" 
                          value={outputConfig.pattern}
                          onChange={(e) => setOutputConfig({...outputConfig, pattern: e.target.value})}
                          className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Suffix</label>
                        <input 
                          type="text" 
                          value={outputConfig.suffix}
                          onChange={(e) => setOutputConfig({...outputConfig, suffix: e.target.value})}
                          placeholder="e.g., _v1"
                          className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                        />
                      </div>
                    </div>

                    <div className="bg-indigo-50 p-4 rounded-lg border border-indigo-100">
                      <p className="text-sm text-indigo-800 mb-2 font-medium">Available Variables:</p>
                      <div className="flex flex-wrap gap-2 text-xs font-mono">
                        <span className="bg-white px-2 py-1 rounded border border-indigo-200">{'{base}'}</span>
                        <span className="bg-white px-2 py-1 rounded border border-indigo-200">{'{design}'}</span>
                        <span className="bg-white px-2 py-1 rounded border border-indigo-200">{'{category}'}</span>
                      </div>
                    </div>

                    <div className="mt-4">
                      <p className="text-sm font-medium text-gray-700 mb-1">Example Output:</p>
                      <p className="font-mono text-sm bg-gray-100 p-3 rounded-lg border border-gray-200 text-gray-800">
                        {outputConfig.prefix}
                        {outputConfig.pattern
                          .replace('{base}', 'White-TShirt')
                          .replace('{design}', 'Cool-Logo')
                          .replace('{category}', 'Summer')}
                        {outputConfig.suffix}.png
                      </p>
                    </div>
                  </div>

                </div>
              </div>

              <div className="mt-6 pt-6 border-t border-gray-100 flex justify-end">
                <button 
                  onClick={generateZip}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3 rounded-xl font-medium transition-colors shadow-sm inline-flex items-center gap-2"
                >
                  <Layers className="w-5 h-5" /> 
                  Generate {baseProducts.length * designs.length} Mockups
                </button>
              </div>
            </div>
          )}

          {/* STEP 4: RESULTS */}
          {step === 4 && (
            <div className="h-full flex flex-col items-center justify-center text-center">
              {isGenerating ? (
                <div className="max-w-md w-full">
                  <div className="w-20 h-20 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-6">
                    <RefreshCw className="w-10 h-10 animate-spin" />
                  </div>
                  <h2 className="text-2xl font-bold mb-2">Generating Mockups...</h2>
                  <p className="text-gray-500 mb-8">
                    Processing {progress.current} of {progress.total} images. Please don't close this tab.
                  </p>
                  
                  <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
                    <div 
                      className="bg-indigo-600 h-4 rounded-full transition-all duration-300" 
                      style={{ width: `${(progress.current / progress.total) * 100}%` }}
                    ></div>
                  </div>
                </div>
              ) : (
                <div className="max-w-md w-full">
                  <div className="w-20 h-20 bg-green-50 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
                    <CheckCircle2 className="w-10 h-10" />
                  </div>
                  <h2 className="text-2xl font-bold mb-2">Generation Complete!</h2>
                  <p className="text-gray-500 mb-8">
                    Successfully generated {progress.total} mockups. Your ZIP file should have downloaded automatically.
                  </p>
                  
                  <div className="flex flex-col gap-3">
                    {downloadUrl && (
                      <a 
                        href={downloadUrl} 
                        download="mockups.zip"
                        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl font-medium transition-colors shadow-sm inline-flex items-center justify-center gap-2"
                      >
                        <Download className="w-5 h-5" />
                        Download ZIP Again
                      </a>
                    )}
                    <button 
                      onClick={() => {
                        setStep(1);
                        setDownloadUrl(null);
                      }}
                      className="w-full bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 px-6 py-3 rounded-xl font-medium transition-colors shadow-sm"
                    >
                      Start New Batch
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

        </div>
      </main>
    </div>
  );
}
