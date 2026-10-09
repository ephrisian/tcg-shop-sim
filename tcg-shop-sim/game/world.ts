import { GAME_CONFIG } from './config';

export const districtDistanceInHops = (fromDistrictId: string, toDistrictId: string): number | null => {
  const districts = GAME_CONFIG.worldMap.districts;
  const from = districts.find(district => district.id === fromDistrictId);
  const to = districts.find(district => district.id === toDistrictId);
  if (!from || !to) return null;
  if (from.cityId === to.cityId) {
    return Math.abs(from.x - to.x) + Math.abs(from.y - to.y);
  }

  const homeCityId = GAME_CONFIG.worldMap.cities.find(city => city.unlocked)?.id;
  const fromCity = GAME_CONFIG.worldMap.cities.find(city => city.id === from.cityId);
  const toCity = GAME_CONFIG.worldMap.cities.find(city => city.id === to.cityId);
  if (!fromCity || !toCity) return null;
  const cityHops = from.cityId === homeCityId
    ? toCity.travelHops || 3
    : to.cityId === homeCityId
      ? fromCity.travelHops || 3
      : (fromCity.travelHops || 3) + (toCity.travelHops || 3);

  const homeDistrict = districts.find(district => district.cityId === homeCityId);
  const localOffset = (districtId: string, cityId: string): number => {
    const district = districts.find(item => item.id === districtId);
    const hub = cityId === homeCityId
      ? homeDistrict
      : districts.find(item => item.cityId === cityId);
    return district && hub ? Math.abs(district.x - hub.x) + Math.abs(district.y - hub.y) : 0;
  };

  return cityHops + localOffset(from.id, from.cityId) + localOffset(to.id, to.cityId);
};
