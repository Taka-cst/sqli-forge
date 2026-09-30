FROM nginx:alpine
COPY index.html style.css data.js app.js /usr/share/nginx/html/
EXPOSE 80
