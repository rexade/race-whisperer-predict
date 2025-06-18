
import { useState } from 'react';
import { V75RaceData } from '../../../services/v75CalendarApi';
import { validateRaceData, fixRaceDataIssues } from '../../../services/raceDataValidator';
import { convertV75ToEnhancedRaceData, convertEnhancedToV75RaceData } from '../utils/raceDataConverters';
import { useToast } from "@/hooks/use-toast";

export const useV75DataValidation = () => {
  const { toast } = useToast();

  const validateAndFixRaces = async (v75Races: V75RaceData[]): Promise<V75RaceData[]> => {
    console.log(`\n🔧 === APPLYING ENHANCED DATA VALIDATION (SCRATCH-AWARE) ===`);
    const fixedV75Races: V75RaceData[] = [];

    for (let i = 0; i < v75Races.length; i++) {
      const race = v75Races[i];
      console.log(`\n--- 🔍 Validating race ${race.raceNumber} (${race.horses.length} horses) ---`);

      // Convert to EnhancedRaceData format for validation
      const enhancedRace = convertV75ToEnhancedRaceData(race);

      // Validate the race data with scratch-aware logic
      const validation = validateRaceData(enhancedRace);

      if (!validation.isValid) {
        console.log(`⚠️ Race ${race.raceNumber} has validation issues:`, validation.errors);
        console.log(`🔧 Applying fixes for race ${race.raceNumber} (preserving scratches)...`);

        // Apply fixes that distinguish between scratches and real errors
        const fixedEnhancedRace = fixRaceDataIssues(enhancedRace);

        // Convert back to V75RaceData format
        const fixedRace = convertEnhancedToV75RaceData(fixedEnhancedRace);

        console.log(`✅ Race ${race.raceNumber} fixed successfully - scratches preserved`);
        fixedV75Races.push(fixedRace);

        // Show toast notification about the fix
        toast({
          title: `Race ${race.raceNumber} Data Fixed`,
          description: `Applied fixes for duplicate positions while preserving scratched horses`,
          variant: "default",
        });
      } else {
        console.log(`✅ Race ${race.raceNumber} validation passed - ${validation.warnings.length > 0 ? 'with scratches noted' : 'no issues'}`);
        if (validation.warnings.length > 0) {
          console.log(`ℹ️ Race ${race.raceNumber} warnings:`, validation.warnings);
        }
        fixedV75Races.push(race);
      }
    }

    console.log(`🏁 Enhanced data validation complete: ${fixedV75Races.length} races ready for analysis`);
    console.log(`📊 Total horses across all races: ${fixedV75Races.reduce((sum, r) => sum + r.horses.length, 0)}`);

    return fixedV75Races;
  };

  return {
    validateAndFixRaces
  };
};
