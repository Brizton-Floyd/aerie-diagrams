import { inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';

export function users() {
  const http = inject(HttpClient);
  return http.get('/admin/users');
}
