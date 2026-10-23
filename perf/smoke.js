import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: 1,
  duration: '10s',
};

export default function () {
  const response = http.get(
    `${process.env.BASE_URL || 'http://localhost:3000'}/api/v1/health`,
  );
  check(response, { 'health endpoint is ok': (res) => res.status === 200 });
  sleep(1);
}
