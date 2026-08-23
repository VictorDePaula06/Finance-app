import React from 'react';
import { useAuth } from '../contexts/AuthContext';

// Estilo aplicando o enquadramento (posição/zoom) escolhido pelo usuário.
export const avatarStyle = (pos) => ({
    width: '100%', height: '100%', objectFit: 'cover',
    objectPosition: `${pos?.x ?? 50}% ${pos?.y ?? 50}%`,
    transform: `scale(${pos?.zoom ?? 1})`, transformOrigin: 'center',
});

// Avatar do usuário reutilizável — lê a foto/enquadramento das preferências ao
// vivo, então atualiza na hora onde quer que apareça (sidebar, dashboard…).
// Se não houver foto personalizada nem do provedor, usa `fallback` (ou a inicial).
export default function UserAvatar({ className = '', fallback = null, fallbackClassName = '', textClassName = '' }) {
    const { currentUser, userPrefs } = useAuth();
    const avatar = userPrefs?.avatarDataUrl || currentUser?.photoURL || '';
    const pos = userPrefs?.avatarPos;
    const initial = (currentUser?.displayName || currentUser?.email || 'U').charAt(0).toUpperCase();

    if (avatar) {
        return (
            <div className={`overflow-hidden ${className}`}>
                <img src={avatar} alt="" style={avatarStyle(pos)} />
            </div>
        );
    }
    if (fallback) return fallback;
    return (
        <div className={`flex items-center justify-center ${className} ${fallbackClassName}`}>
            <span className={textClassName}>{initial}</span>
        </div>
    );
}
