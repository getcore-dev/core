function formatLocation(location) {
    if (!location) return "";

    const parts = location.split(',').map(part => part.trim());

    // Helper function to check if a string is a US state
    const isUSState = (str) => Object.keys(stateMappings).includes(str) || Object.values(stateMappings).includes(str);

    // Helper function to get state abbreviation
    const getStateAbbr = (state) => {
      const fullName = Object.keys(stateMappings).find(key => key.toLowerCase() === state.toLowerCase());
      return fullName ? stateMappings[fullName] : state;
    };

    if (parts.length === 1) {
      return parts[0];
    } else if (parts.length === 2) {
      if (isUSState(parts[1])) {
        return getStateAbbr(parts[1]);
      } else {
        return parts[1]; // Assume it's a non-US country
      }
    } else if (parts.length >= 3) {
      if (parts[2].trim().toLowerCase() === 'united states') {
        return getStateAbbr(parts[1]);
      } else {
        return parts[2]; // Return the country for non-US locations
      }
    }

    return location.trim();
  }

  