import React, { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

/**
 * CONFIGURATION DES CLÉS VERCEL
 * L'Admin a configuré les noms suivants dans Vercel :
 * project_url -> URL de Supabase
 * anon_public_key -> Clé publique
 */
const supabaseUrl = import.meta.env.VITE_PROJECT_URL || import.meta.env.project_url;
const supabaseAnonKey = import.meta.env.VITE_ANON_PUBLIC_KEY || import.meta.env.anon_public_key;

// Initialisation unique
const supabase = createClient(supabaseUrl, supabaseAnonKey);

function App() {
  const [status, setStatus] = useState('loading'); // loading, success, error
  const [message, setMessage] = useState({
    title: 'Vérification en cours...',
    description: 'Veuillez patienter pendant que nous vérifions votre transaction.'
  });

  useEffect(() => {
    const recordPayment = async () => {
      // 1. Extraction des paramètres de l'URL
      const urlParams = new URLSearchParams(window.location.search);
      
      const transactionId = urlParams.get('transactionId') || urlParams.get('transaction_id');
      const orderId = urlParams.get('orderId') || urlParams.get('order_id');
      const amount = parseFloat(urlParams.get('amount')) || 0;

      console.log("Tentative d'enregistrement avec les clés Vercel corrigées");

      // 2. Validation minimale des paramètres
      if (!transactionId || !orderId) {
        setStatus('error');
        setMessage({
          title: 'Enfòmasyon manke',
          description: "Nou pa jwenn detay tranzaksyon an. Si pèyman an fèt deja, kontakte sipò a."
        });
        return;
      }

      try {
        // 3. Vérifier si la commande existe déjà
        const { data: existingPayment, error: fetchError } = await supabase
          .from('payments')
          .select('*')
          .eq('order_id', orderId)
          .maybeSingle();

        if (fetchError) throw fetchError;

        if (existingPayment) {
          // Si déjà COMPLETED, on arrête là
          if (existingPayment.status === 'COMPLETED') {
             setStatus('success');
             setMessage({
               title: 'Pèyman Deja Konfime !',
               description: 'Tranzaksyon sa a te anrejistre deja ak siksè.'
             });
             return;
          }

          // Mise à jour du statut PENDING -> COMPLETED
          const { error: updateError } = await supabase
            .from('payments')
              .update({
                moncash_transaction_id: transactionId,
                status: 'COMPLETED',
                updated_at: new Date().toISOString()
              })
              .eq('order_id', orderId);

          if (updateError) throw updateError;

        } else {
          // Insertion si pas de ligne existante
          const { error: insertError } = await supabase
            .from('payments')
            .insert([{
              order_id: orderId,
              moncash_transaction_id: transactionId,
              amount_htg: amount,
              status: 'COMPLETED',
              payment_method: 'MONCASH',
              updated_at: new Date().toISOString()
            }]);

          if (insertError) throw insertError;
        }

        setStatus('success');
        setMessage({
          title: 'Pèyman Konfime !',
          description: 'Mèsi! Nou resevwa pèyman an. Kòmand ou an ap prepare kounye a.'
        });

      } catch (err) {
        console.error("Erreur de connexion Supabase :", err);
        setStatus('error');
        setMessage({
          title: 'Erè Teknik',
          description: "Nou pa ka konekte ak baz done a. Tcheke si kle Vercel yo kòrèk."
        });
      }
    };

    recordPayment();
  }, []);

  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-50 p-4 font-sans">
      <div className="bg-white p-10 rounded-[3rem] shadow-2xl max-w-md w-full text-center border border-slate-100">
        
        {status === 'loading' && (
          <div className="flex flex-col items-center py-4">
            <div className="w-14 h-14 border-4 border-slate-100 border-t-[#CC0000] rounded-full animate-spin mb-6"></div>
            <h1 className="text-xl font-black text-slate-800 uppercase tracking-tight">{message.title}</h1>
            <p className="text-slate-400 mt-2 font-bold text-sm uppercase tracking-wider">{message.description}</p>
          </div>
        )}

        {status === 'success' && (
          <div className="animate-in zoom-in-95 duration-500">
            <div className="w-24 h-24 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-8 shadow-inner">
              <svg className="w-12 h-12 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"></path>
              </svg>
            </div>
            <h1 className="text-3xl font-black text-slate-900 uppercase tracking-tighter mb-3">{message.title}</h1>
            <p className="text-slate-500 font-bold leading-relaxed">{message.description}</p>
            
            <a 
              href="achtesa://payment-success" 
              className="group relative inline-flex items-center justify-center mt-10 w-full"
            >
              <div className="absolute -inset-1 bg-gradient-to-r from-red-600 to-black rounded-2xl blur opacity-25 group-hover:opacity-50 transition duration-1000"></div>
              <button className="relative w-full bg-black text-white px-8 py-5 rounded-2xl font-black uppercase text-sm tracking-widest hover:bg-slate-900 transition-colors">
                Tounen nan aplikasyon an
              </button>
            </a>
          </div>
        )}

        {status === 'error' && (
          <div className="animate-in fade-in slide-in-from-top-4 duration-500">
            <div className="w-24 h-24 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-8">
              <svg className="w-12 h-12 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"></path>
              </svg>
            </div>
            <h1 className="text-3xl font-black text-red-600 uppercase tracking-tighter mb-3">{message.title}</h1>
            <p className="text-slate-500 font-bold leading-relaxed">{message.description}</p>
            
            <button 
              onClick={() => window.location.reload()}
              className="mt-10 bg-slate-100 text-slate-800 px-8 py-4 rounded-2xl font-black uppercase text-xs tracking-[0.2em] hover:bg-slate-200 transition-colors"
            >
              Eseye ankò
            </button>
          </div>
        )}

        <div className="mt-12 pt-8 border-t border-slate-50 flex flex-col items-center space-y-2">
          <div className="flex items-center space-x-2 grayscale opacity-50">
             <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Secured by MonCash</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
