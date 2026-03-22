/**
 * Shared Helper Utilities for UDAAN Team Portal
 * Common functions used across dashboard components
 */

import React from 'react';
import {
    Crown, Shield, Scroll, Briefcase, Hexagon, Plane, Rocket, Target, User,
    CheckCircle2, Clock, Circle
} from 'lucide-react';

/**
 * Map role to icon name
 */
export const getRoleIcon = (role: string): string => {
    if (role.toLowerCase().includes('president') && !role.toLowerCase().includes('vice')) return 'shield';
    if (role.toLowerCase().includes('vice president')) return 'star';
    if (role.toLowerCase().includes('secretary')) return 'scroll';
    if (role.toLowerCase().includes('treasurer') || role.toLowerCase().includes('management')) return 'briefcase';
    if (role.toLowerCase().includes('drone')) return 'hexagon';
    if (role.toLowerCase().includes('plane')) return 'plane';
    if (role.toLowerCase().includes('rocket')) return 'rocket';
    return 'target';
};

/**
 * Get icon component by name
 */
export const getIcon = (iconName: string, size = 24) => {
    const icons: { [key: string]: React.ReactNode } = {
        crown: <Crown size={ size } />,
    shield: <Shield size={ size } />,
    scroll: <Scroll size={ size } />,
    briefcase: <Briefcase size={ size } />,
    hexagon: <Hexagon size={ size } />,
    plane: <Plane size={ size } />,
    rocket: <Rocket size={ size } />,
    target: <Target size={ size } />,
    user: <User size={ size } />,
};

return icons[iconName] || <Target size={ size } />;
};

/**
 * Get status icon component
 */
export const getStatusIcon = (status: string) => {
    switch (status) {
        case 'completed': return <CheckCircle2 size={ 16 } className = "text-green-400" />;
        case 'in-progress': return <Clock size={ 16 } className = "text-yellow-400" />;
        case 'pending': return <Circle size={ 16 } className = "text-gray-400" />;
        default: return <Circle size={ 16 } className = "text-gray-400" />;
    }
};

/**
 * Get priority color classes for badges and borders
 */
export const getPriorityColor = (priority: string) => {
    switch ((priority || '').toLowerCase()) {
        case 'high':
            return 'border-red-300 text-red-700 bg-red-50';
        case 'medium':
            return 'border-yellow-300 text-yellow-700 bg-yellow-50';
        case 'low':
            return 'border-green-300 text-green-700 bg-green-50';
        default:
            return 'border-gray-300 text-gray-700 bg-white';
    }
};
