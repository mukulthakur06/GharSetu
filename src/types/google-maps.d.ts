declare namespace google.maps {
  interface LatLng {
    lat(): number;
    lng(): number;
  }

  interface LatLngLiteral {
    lat: number;
    lng: number;
  }

  interface CircleOptions {
    map?: unknown;
    center?: LatLngLiteral;
    radius?: number;
    strokeColor?: string;
    strokeOpacity?: number;
    strokeWeight?: number;
    fillColor?: string;
    fillOpacity?: number;
    clickable?: boolean;
  }

  class Circle {
    constructor(opts?: CircleOptions);
    setMap(map: unknown | null): void;
  }

  namespace places {
    class AutocompleteSessionToken {
      constructor();
    }

    interface Place {
      displayName?: string | null;
      formattedAddress?: string | null;
      location?: LatLng | null;
      fetchFields(options: { fields: string[] }): Promise<{ place: Place }>;
    }

    interface PlacePrediction {
      placeId: string;
      text: { text: string };
      toPlace(): Place;
    }

    interface AutocompleteSuggestion {
      placePrediction?: PlacePrediction;
    }

    interface AutocompleteRequest {
      input: string;
      sessionToken?: AutocompleteSessionToken;
      includedRegionCodes?: string[];
    }
  }
}
