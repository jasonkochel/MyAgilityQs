// Validation utilities
import { CompetitionClass, CompetitionLevel, COMPETITION_CLASSES, COMPETITION_LEVELS } from './types';

export const isValidCompetitionClass = (value: string): value is CompetitionClass => {
  return COMPETITION_CLASSES.includes(value as CompetitionClass);
};

export const isValidCompetitionLevel = (value: string): value is CompetitionLevel => {
  return COMPETITION_LEVELS.includes(value as CompetitionLevel);
};

export const isValidPlacement = (value: number | null): boolean => {
  return value === null || (Number.isInteger(value) && value >= 1 && value <= 4);
};

export const isValidDate = (dateString: string): boolean => {
  const regex = /^\d{4}-\d{2}-\d{2}$/;
  if (!regex.test(dateString)) return false;
  
  const date = new Date(dateString);
  return date instanceof Date && !isNaN(date.getTime());
};

export const isValidTime = (time: number): boolean => {
  return time > 0 && time < 600; // Reasonable bounds: 0-10 minutes
};

export const isValidMachPoints = (points: number): boolean => {
  return Number.isInteger(points) && points >= 0 && points <= 100;
};

// Utility functions
export const formatTime = (seconds: number): string => {
  return seconds.toFixed(2);
};

export const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleDateString();
};

// Export all utilities from utils folder
export * from './utils/index.js';
