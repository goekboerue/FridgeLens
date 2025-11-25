import React, { useState } from 'react';
import { MarketStore } from '../types';

interface Props {
  missingIngredients: string[];
}

const MOCK_STORES: MarketStore[] = [
  { name: "Hızlı Market", distance: "0.5 km", deliveryTime: "10-15 dk", price: "₺₺" },
  { name: "Taze Yöresel", distance: "1.2 km", deliveryTime: "20-30 dk", price: "₺₺₺" },
];

export const MarketIntegration: React.FC<Props> = ({ missingIngredients }) => {
  const [ordered, setOrdered] = useState(false);

  // Safety check: ensure missingIngredients exists and has items
  if (!missingIngredients || missingIngredients.length === 0) return null;

  return (
    <div className="mt-4 p-4 bg-orange-50 border border-orange-100 rounded-xl">
      <div className="flex items-start gap-3">
        <div className="bg-orange-100 p-2 rounded-full text-orange-600">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" />
          </svg>
        </div>
        <div className="flex-1">
          <h4 className="font-semibold text-orange-900 text-sm mb-1">Eksik Malzeme Tamamlayıcı</h4>
          <p className="text-xs text-orange-800 mb-3">
            Bu tarif için <strong>{missingIngredients.length}</strong> eksik malzeme var: {missingIngredients.join(', ')}.
          </p>
          
          {!ordered ? (
            <div className="space-y-2">
              {MOCK_STORES.map((store, idx) => (
                <button 
                  key={idx}
                  onClick={() => setOrdered(true)}
                  className="w-full flex items-center justify-between p-2 bg-white rounded-lg border border-orange-200 hover:border-orange-400 transition-colors shadow-sm"
                >
                  <div className="text-left">
                    <div className="text-xs font-bold text-slate-800">{store.name}</div>
                    <div className="text-[10px] text-slate-500">{store.distance} • {store.deliveryTime}</div>
                  </div>
                  <div className="text-xs font-semibold text-emerald-600">Sipariş Ver &rarr;</div>
                </button>
              ))}
            </div>
          ) : (
            <div className="p-3 bg-green-100 rounded-lg flex items-center gap-2 text-green-800 animate-pulse">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
              </svg>
              <span className="text-xs font-medium">Sipariş oluşturuldu! 15 dk içinde kapında.</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};