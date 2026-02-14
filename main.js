
import { createClient } from '@supabase/supabase-js'

// Configuration Supabase
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Supabase keys are missing!')
}

const supabase = createClient(supabaseUrl, supabaseAnonKey)

const APP_DEEP_LINK = "votre-app-scheme://success";

async function recordPayment() {
    // Extraction des paramètres de l'URL
    const urlParams = new URLSearchParams(window.location.search);
    const transactionId = urlParams.get('transactionId') || urlParams.get('transaction_id');
    const orderId = urlParams.get('orderId') || urlParams.get('order_id');

    // Si pas d'ID de transaction, on ne fait rien (accès direct à la page ?)
    if (!transactionId || !orderId) {
        console.log("Aucun paramètre de transaction trouvé.");
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
            document.querySelector('h1').innerText = "Erreur de vérification";
            document.querySelector('p').innerText = "Une erreur est survenue lors de la vérification de votre paiement.";
            return;
        }

        if (existingPayment) {
            console.log("Paiement déjà enregistré.");
            // Déjà enregistré, on update juste le statut si nécessaire ou on laisse
            const { error: updateError } = await supabase
                .from('payments')
                .update({
                    moncash_transaction_id: transactionId,
                    status: 'COMPLETED', // On assume que si on est redirigé ici, c'est un succès
                    updated_at: new Date().toISOString()
                })
                .eq('order_id', orderId);

            if (updateError) console.error("Erreur update:", updateError);
        } else {
            console.log("Nouveau paiement, tentative d'insertion...");
            // Note: 'amount_htg' est NOT NULL dans le schéma. 
            // Si MonCash ne le renvoie pas dans l'URL de retour, il faudra une valeur par défaut ou le récupérer autrement.
            // Pour l'instant on met 0 ou on essaie de le lire des params.
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
                        payload: { raw_params: Object.fromEntries(urlParams) } // Sauvegarde tout pour debug
                    }
                ]);

            if (insertError) {
                console.error("Erreur insertion:", insertError);
                document.querySelector('h1').innerText = "Erreur d'enregistrement";
                document.querySelector('p').innerText = "Nous avons reçu votre paiement mais n'avons pas pu l'enregistrer automatiquement. Veuillez contacter le support.";
            } else {
                console.log("Paiement enregistré avec succès !");
            }
        }

    } catch (err) {
        console.error("Exception inattendue:", err);
    }
}

// Exécuter au chargement
recordPayment();

document.getElementById('app-link').addEventListener('click', function (e) {
    // Redirection vers l'app
    // window.location.href = APP_DEEP_LINK;
});
