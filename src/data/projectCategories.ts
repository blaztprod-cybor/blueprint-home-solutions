import type { LucideIcon } from 'lucide-react';
import {
  Bath,
  BrickWall,
  Fence,
  Heater,
  Home,
  Leaf,
  PanelsTopLeft,
  ShieldCheck,
  Users,
  WavesLadder,
  Wind,
  Wrench,
} from 'lucide-react';

export type ProjectCategory = {
  id: string;
  title: string;
  icon: LucideIcon;
  image: string;
  imagePosition?: string;
};

export const projectCategories: ProjectCategory[] = [
  { id: 'roofs', title: 'Roofs', icon: Home, image: '/trade-roof.jpg', imagePosition: 'center center' },
  { id: 'bathrooms', title: 'Bathrooms', icon: Bath, image: '/trade-bathroom.jpg', imagePosition: 'center center' },
  { id: 'kitchens', title: 'Kitchens', icon: PanelsTopLeft, image: '/trade-kitchen.jpg', imagePosition: 'center center' },
  { id: 'basements', title: 'Basements', icon: WavesLadder, image: '/trade-basement.jpg', imagePosition: 'center center' },
  { id: 'windows', title: 'Windows', icon: Wind, image: '/trade-windows.jpg', imagePosition: 'center center' },
  { id: 'fencing', title: 'Fencing', icon: Fence, image: '/trade-fencing.jpg', imagePosition: 'center center' },
  { id: 'brickwork', title: 'Brick Work', icon: BrickWall, image: '/trade-brick-work.jpg', imagePosition: 'center center' },
  { id: 'floors', title: 'Floors', icon: PanelsTopLeft, image: '/trade-wood-floors.jpg', imagePosition: 'center center' },
  { id: 'hvac', title: 'HVAC', icon: Heater, image: '/hero-image-v2.jpg', imagePosition: 'center 80%' },
  { id: 'energy', title: 'Energy Efficiency', icon: Wrench, image: '/hero-image.jpg', imagePosition: 'center 55%' },
  { id: 'compliance', title: 'Code Compliance', icon: ShieldCheck, image: '/stage1.png', imagePosition: 'center 35%' },
  { id: 'senior', title: 'Senior Services', icon: Users, image: '/stage4.png', imagePosition: 'center 25%' },
  { id: 'environmental', title: 'Environmental', icon: Leaf, image: '/hero-image-v2.jpg', imagePosition: 'center 65%' },
];
