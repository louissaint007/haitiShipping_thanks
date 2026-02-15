import React, { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

// Configuration Supabase
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Supabase keys are missing!');
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

function App() {
    const [status, setStatus] = useState('loading'); // loading, success, error
    const [message, setMessage] = useState({
        title: 'Vérification en cours...',
        description: 'Veuillez patienter pendant que nous vérifions votre transaction.'
    });

    useEffect(() => {
        const recordPayment = async () => {
            // Extraction des paramètres de l'URL
            const urlParams = new URLSearchParams(window.location.search);
            const transactionId = urlParams.get('transactionId') || urlParams.get('transaction_id');
            const orderId = urlParams.get('orderId') || urlParams.get('order_id');

            // Si pas d'ID de transaction, on ne fait rien (accès direct à la page ?)
            if (!transactionId || !orderId) {
                console.log("Aucun paramètre de transaction trouvé.");
                setStatus('error');
                setMessage({
                    title: 'Information manquante',
                    description: "Aucun paramètre de transaction trouvé. Si vous pensez qu'il s'agit d'une erreur, contactez le support."
                });
                return;
            }

            console.log(`Traitement de la commande: ${orderId}, Transaction: ${transactionId}`);

            try {
                // 1. Vérifier si la transaction existe déjà
                const { data: existingPayment, error: fetchError } = await supabase
                    .from('payments')
                    .select('id')
                    .eq('order_id', orderId)
                    .single();

                if (fetchError && fetchError.code !== 'PGRST116') { // PGRST116 = not found
                    console.error("Erreur lors de la vérification:", fetchError);
                    setStatus('error');
                    setMessage({
                        title: 'Erreur de vérification',
                        description: "Une erreur est survenue lors de la vérification de votre paiement."
                    });
                    return;
                }

                if (existingPayment) {
                    console.log("Paiement déjà enregistré.");
                    // Déjà enregistré, on update juste le statut si nécessaire
                    await supabase
                        .from('payments')
                        .update({
                            moncash_transaction_id: transactionId,
                            status: 'COMPLETED',
                            updated_at: new Date().toISOString()
                        })
                        .eq('order_id', orderId);

                    setStatus('success');
                    setMessage({
                        title: 'Paiement Confirmé !',
                        description: 'Merci pour votre confiance. Votre transaction a été traitée avec succès et votre colis est en cours de préparation.'
                    });

                } else {
                    console.log("Nouveau paiement, tentative d'insertion...");
                    const amount = parseFloat(urlParams.get('amount')) || 0;

                    const { error: insertError } = await supabase
                        .from('payments')
                        .insert([
                            {
                                order_id: orderId,
                                moncash_transaction_id: transactionId,
                                amount_htg: amount,
                                status: 'COMPLETED',
                                payment_method: 'MONCASH',
                                payload: { raw_params: Object.fromEntries(urlParams) }
                            }
                        ]);

                    if (insertError) {
                        console.error("Erreur insertion:", insertError);
                        setStatus('error');
                        setMessage({
                            title: "Erreur d'enregistrement",
                            description: "Nous avons reçu votre paiement mais n'avons pas pu l'enregistrer automatiquement. Veuillez contacter le support."
                        });
                    } else {
                        console.log("Paiement enregistré avec succès !");
                        setStatus('success');
                        setMessage({
                            title: 'Paiement Confirmé !',
                            description: 'Merci pour votre confiance. Votre transaction a été traitée avec succès et votre colis est en cours de préparation.'
                        });
                    }
                }

            } catch (err) {
                console.error("Exception inattendue:", err);
                setStatus('error');
                setMessage({
                    title: 'Erreur Inattendue',
                    description: "Une erreur inattendue s'est produite."
                });
            }
        };

        recordPayment();
    }, []);

    return (
        <div className="card">
            {status === 'success' && (
                <div className="icon-container">
                    <svg className="checkmark" viewBox="0 0 52 52">
                        <path d="M14.1 27.2l7.1 7.2 16.7-16.8" />
                    </svg>
                </div>
            )}

            {/* Simple loading icon or placeholder if loading */}
            {status === 'loading' && (
                <div style={{ marginBottom: '20px' }}>
                    <div style={{
                        width: '40px',
                        height: '40px',
                        border: '4px solid #f3f3f3',
                        borderRadius: '50%',
                        borderTop: '4px solid #cf0921',
                        animation: 'spin 1s linear infinite',
                        margin: '0 auto'
                    }}></div>
                    <style>{`
                 @keyframes spin {
                   0% { transform: rotate(0deg); }
                   100% { transform: rotate(360deg); }
                 }
               `}</style>
                </div>
            )}

            <h1>{message.title}</h1>
            <p>{message.description}</p>

            {/* 
          TODO: Add logic for 'app-link' deep linking if needed. 
          Currently just a placeholder link button.
      */}
            <a href="#" className="btn">Retourner vers l'application</a>

            <div className="footer">
                Transaction sécurisée par MonCash
            </div>
        </div>
    );
}

export default App;
