import React, { useEffect, useState } from 'react';
import './index.css';

function App() {
    const [status, setStatus] = useState('loading'); // 'loading', 'success', 'error'
    const [message, setMessage] = useState('Vérification de votre transaction...');

    useEffect(() => {
        const verifyTransaction = async () => {
            const urlParams = new URLSearchParams(window.location.search);
            // MonCash redirects with 'transactionId' typically
            const transactionId = urlParams.get('transactionId');
            const orderId = urlParams.get('orderId'); // We might pass this along

            if (!transactionId) {
                setStatus('error');
                setMessage("Identifiant de transaction manquant. Veuillez contacter le support.");
                return;
            }

            try {
                // Call our Vercel API route
                const response = await fetch(`/api/verify?transactionId=${transactionId}&orderId=${orderId || ''}`);
                const data = await response.json();

                if (response.ok && data.success) {
                    setStatus('success');
                    setMessage("Merci ! Votre paiement a été confirmé avec succès.");
                } else {
                    console.error("Verification failed:", data);
                    setStatus('error');
                    setMessage("Impossible de vérifier la transaction. " + (data.error || ""));
                }
            } catch (error) {
                console.error("Network error:", error);
                setStatus('error');
                setMessage("Une erreur de communication est survenue.");
            }
        };

        verifyTransaction();
    }, []);

    return (
        <div className="card">
            {status === 'success' && (
                <div className="icon-container">
                    <svg className="checkmark" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52">
                        <circle className="checkmark-circle" cx="26" cy="26" r="25" fill="none" />
                        <path className="checkmark-check" fill="none" d="M14.1 27.2l7.1 7.2 16.7-16.8" />
                    </svg>
                    <div className="confetti"></div>
                    <div className="confetti" style={{ left: '10%', animationDelay: '0.2s' }}></div>
                    <div className="confetti" style={{ right: '10%', animationDelay: '0.5s' }}></div>
                </div>
            )}

            {status === 'loading' && (
                <div className="spinner-container">
                    <div className="spinner"></div>
                </div>
            )}

            {status === 'error' && (
                <div className="icon-container" style={{ background: '#fde8e8' }}>
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M12 22C17.5 22 22 17.5 22 12C22 6.5 17.5 2 12 2C6.5 2 2 6.5 2 12C2 17.5 6.5 22 12 22Z" stroke="#e02424" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M12 8V12" stroke="#e02424" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M12 16H12.01" stroke="#e02424" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                </div>
            )}

            <h1>{status === 'success' ? 'Paiement Réussi !' : (status === 'error' ? 'Oups !' : 'Vérification...')}</h1>
            <p>{message}</p>

            {status !== 'loading' && (
                <a href="#" className="btn" onClick={(e) => { e.preventDefault(); window.close(); }}>
                    Fermer la fenêtre
                </a>
            )}

            <div className="footer">
                Transaction sécurisée par MonCash
            </div>
        </div>
    );
}

export default App;
