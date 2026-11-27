const routes = [
  {
    path: '/login',
    component: () => import('../pages/LoginPage.vue'),
    meta: { guestOnly: true },
  },
  {
    path: '/',
    component: () => import('../layouts/MainLayout.vue'),
    meta: { requiresAuth: true },
    children: [
      { path: '', component: () => import('../pages/EmployeesPage.vue') },
      { path: 'employees', redirect: '/' },
      { path: 'organizations', component: () => import('../pages/OrganizationsPage.vue') },
      { path: 'departments', component: () => import('../pages/DepartmentsPage.vue') },
      { path: 'positions', component: () => import('../pages/PositionsPage.vue') },
      { path: 'history', component: () => import('../pages/HistoryPage.vue') },
      {
        path: 'users',
        component: () => import('../pages/UsersPage.vue'),
        meta: { requiresAdmin: true },
      },
    ],
  },
  {
    path: '/:catchAll(.*)*',
    redirect: '/',
  },
];

export default routes;