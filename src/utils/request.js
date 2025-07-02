import axios from 'axios';

const service = axios.create({
  baseURL: '', // 可根据需要设置
  timeout: 10000
});

service.interceptors.request.use(config => {
  // 可在此处添加token等
  return config;
}, error => Promise.reject(error));

service.interceptors.response.use(
  response => response.data,
  error => Promise.reject(error)
);

export function get(url, params) {
  return service.get(url, { params });
}

export function post(url, data) {
  return service.post(url, data);
}

export default service; 