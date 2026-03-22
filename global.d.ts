/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { HTMLMotionProps } from 'framer-motion';
import { ComponentType } from 'react';

// Vite environment variables type
interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// Fix framer-motion types for React 19 compatibility
declare module 'framer-motion' {
  export interface MotionProps {
    className?: string;
    style?: React.CSSProperties | { [key: string]: any };
    onClick?: React.MouseEventHandler<HTMLElement>;
    onMouseMove?: React.MouseEventHandler<HTMLElement>;
    onMouseEnter?: React.MouseEventHandler<HTMLElement>;
    onMouseLeave?: React.MouseEventHandler<HTMLElement>;
    onSubmit?: React.FormEventHandler<HTMLFormElement>;
    children?: React.ReactNode;
  }

  // Extend HTMLMotionProps to include className and other standard HTML attributes
  export interface HTMLMotionProps<T extends keyof HTMLElementTagNameMap> {
    className?: string;
    style?: React.CSSProperties;
    onClick?: React.MouseEventHandler<HTMLElement>;
    onMouseMove?: React.MouseEventHandler<HTMLElement>;
    onMouseEnter?: React.MouseEventHandler<HTMLElement>;
    onMouseLeave?: React.MouseEventHandler<HTMLElement>;
    children?: React.ReactNode;
  }
}

// Extend JSX IntrinsicElements with Three.js elements
// This provides type support for @react-three/fiber JSX elements
declare global {
  namespace JSX {
    interface IntrinsicElements {
      // Three.js core
      group: any;
      mesh: any;
      line: any;
      points: any;
      primitive: any;
      scene: any;
      object3D: any;
      
      // Geometries  
      boxGeometry: any;
      planeGeometry: any;
      sphereGeometry: any;
      cylinderGeometry: any;
      coneGeometry: any;
      torusGeometry: any;
      circleGeometry: any;
      ringGeometry: any;
      tubeGeometry: any;
      extrudeGeometry: any;
      latheGeometry: any;
      shapeGeometry: any;
      bufferGeometry: any;
      
      // Materials
      meshBasicMaterial: any;
      meshStandardMaterial: any;
      meshPhysicalMaterial: any;
      meshPhongMaterial: any;
      meshLambertMaterial: any;
      meshNormalMaterial: any;
      meshToonMaterial: any;
      meshDepthMaterial: any;
      lineBasicMaterial: any;
      lineDashedMaterial: any;
      pointsMaterial: any;
      shaderMaterial: any;
      spriteMaterial: any;
      
      // Lights
      ambientLight: any;
      directionalLight: any;
      pointLight: any;
      spotLight: any;
      hemisphereLight: any;
      rectAreaLight: any;
      
      // Helpers
      gridHelper: any;
      axesHelper: any;
      boxHelper: any;
      
      // Misc
      fog: any;
      fogExp2: any;
      color: any;
      sprite: any;
    }
  }
}

export {};
