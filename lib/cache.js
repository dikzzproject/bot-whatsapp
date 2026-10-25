const cache = new Map();
const setCache = (key, value, ttl = 60000 * 60) => {
  cache.set(key, value);
  setTimeout(() => {
    cache.clear();
  }, ttl);
};
const getCache = (key, value) => {
  cache.get(key, value)
};

export default cache;
export {setCache};