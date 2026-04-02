import type { LucideIcon } from 'lucide-react';
import {
  Bath,
  BrickWall,
  Fence,
  Home,
  Leaf,
  PanelsTopLeft,
  PlugZap,
  ShieldCheck,
  ShowerHead,
  WrenchIcon,
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
  { id: 'project-management', title: 'Management', icon: Wrench, image: '/market-project-management.jpg', imagePosition: 'center center' },
  { id: 'electrical', title: 'Electrical', icon: PlugZap, image: '/market-electrical.jpg', imagePosition: 'center center' },
  { id: 'energy', title: 'Efficiency', icon: Wrench, image: '/market-energy-efficiency.jpg', imagePosition: 'center center' },
  { id: 'compliance', title: 'Compliance', icon: ShieldCheck, image: '/market-code-compliance.jpg', imagePosition: 'center center' },
  { id: 'environmental', title: 'Environment', icon: Leaf, image: '/market-environmental.jpg', imagePosition: 'center center' },
  { id: 'painting', title: 'Painting', icon: PanelsTopLeft, image: '/market-painting.jpg', imagePosition: 'center center' },
  { id: 'plumber', title: 'Plumber', icon: ShowerHead, image: '/market-plumber.jpg', imagePosition: 'center center' },
  { id: 'handyman', title: 'Handyman', icon: WrenchIcon, image: '/market-handyman.jpg', imagePosition: 'center center' },
];
