<template>
  <footer class="site-footer">
    <div class="container">
      <div class="footer-content">
        <div class="footer-logo">
          <h2>GameHub</h2>
          <p>Play, share, and discover web mini-games</p>
        </div>
        <div class="footer-links">
          <div class="link-group">
            <h3>Platform</h3>
            <ul>
              <li><router-link to="/">Home</router-link></li>
              <li><router-link to="/games">Games</router-link></li>
              <li><router-link to="/upload">Upload Game</router-link></li>
            </ul>
          </div>
          <div class="link-group">
            <h3>About</h3>
            <ul>
              <li><a href="#">How it works</a></li>
              <li><a href="#">Privacy Policy</a></li>
              <li><a href="#">Terms of Service</a></li>
            </ul>
          </div>
        </div>
      </div>
      <div class="footer-bottom">
        <p>&copy; {{ new Date().getFullYear() }} GameHub. All rights reserved.</p>
      </div>
    </div>
  </footer>
</template>

<style scoped>
.site-footer {
  background-color: var(--color-surface);
  padding: 3rem 0 1.5rem;
  margin-top: 3rem;
  border-top: 1px solid rgba(0, 0, 0, 0.1);
}

.footer-content {
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.footer-logo h2 {
  margin: 0;
  background: linear-gradient(to right, var(--color-primary), var(--color-accent));
  -webkit-background-clip: text;
  color: transparent;
}

.footer-logo p {
  margin-top: 0.5rem;
  color: var(--color-text-secondary);
}

.footer-links {
  display: flex;
  flex-wrap: wrap;
  gap: 3rem;
}

.link-group h3 {
  font-size: 1.125rem;
  margin-bottom: 1rem;
}

.link-group ul {
  list-style: none;
  padding: 0;
  margin: 0;
}

.link-group li {
  margin-bottom: 0.75rem;
}

.link-group a {
  color: var(--color-text-secondary);
  text-decoration: none;
  transition: color 0.2s;
}

.link-group a:hover {
  color: var(--color-primary);
}

.footer-bottom {
  margin-top: 3rem;
  padding-top: 1.5rem;
  border-top: 1px solid rgba(0, 0, 0, 0.1);
  text-align: center;
  color: var(--color-text-secondary);
  font-size: 0.875rem;
}

@media (min-width: 768px) {
  .footer-content {
    flex-direction: row;
    justify-content: space-between;
  }
  
  .footer-logo {
    max-width: 300px;
  }
}

@media (prefers-color-scheme: dark) {
  .site-footer {
    background-color: var(--color-surface-dark);
    border-top: 1px solid rgba(255, 255, 255, 0.1);
  }
  
  .footer-bottom {
    border-top: 1px solid rgba(255, 255, 255, 0.1);
  }
}
</style>