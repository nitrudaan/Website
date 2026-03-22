
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React from 'react';

export interface SectionProps {
  id: string;
  title: string;
  children: React.ReactNode;
  className?: string;
}

export interface Laureate {
  name: string;
  image: string; // placeholder url
  role: string;
  desc: string;
}

// Note: Global type augmentations are now in global.d.ts
// Note: framer-motion already provides its own MotionProps with proper types
// Additional type augmentations have been removed to avoid conflicts
