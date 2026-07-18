
import { V75RaceData } from '../../../services/v75CalendarApi';
import { validateRaceData, fixRaceDataIssues } from '../../../services/raceDataValidator';
import { convertV75ToEnhancedRaceData, convertEnhancedToV75RaceData } from '../utils/raceDataConverters';
import { useToast } from "@/hooks/use-toast";

export const useV75DataValidation = () => {
  const { toast } = useToast();

  const validateAndFixRaces = async (v75Races: V75RaceData[]): Promise<V75RaceData[]> => {
    const fixedV75Races: V75RaceData[] = [];

    for (let i = 0; i < v75Races.length; i++) {
      const race = v75Races[i];

      // Convert to EnhancedRaceData format for validation
      const enhancedRace = convertV75ToEnhancedRaceData(race);

      // Validate the race data with scratch-aware logic
      const validation = validateRaceData(enhancedRace);

      if (!validation.isValid) {
        // Apply fixes that distinguish between scratches and real errors
        const fixedEnhancedRace = fixRaceDataIssues(enhancedRace);

        // Convert back to V75RaceData format
        const fixedRace = convertEnhancedToV75RaceData(fixedEnhancedRace);

        fixedV75Races.push(fixedRace);

        // Show toast notification about the fix
        toast({
          title: `Race ${race.raceNumber} Data Fixed`,
          description: `Applied fixes for duplicate positions while preserving scratched horses`,
          variant: "default",
        });
      } else {
        fixedV75Races.push(race);
      }
    }


    return fixedV75Races;
  };

  return {
    validateAndFixRaces
  };
};
