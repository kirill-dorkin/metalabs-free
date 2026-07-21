import http from 'http';

const data = JSON.stringify({ prompt: 'test' });

const options = {
  hostname: '127.0.0.1',
  port: 3000,
  path: '/api/generate',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

const req = http.request(options, (res) => {
  let responseData = '';
  res.on('data', (chunk) => responseData += chunk);
  res.on('end', () => console.log('Response:', res.statusCode, responseData));
});

req.on('error', (e) => console.error(`Problem with request: ${e.message}`));
req.write(data);
req.end();
