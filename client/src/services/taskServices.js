import axios from "axios";
// const apiUrl = "http://server2-project10.apps.eu45.prod.nextcle.com/api/tasks";
// const apiUrl = "http://"+process.env.ENV_PORT+":8080/api/tasks";
// const apiUrl = "http://backend:8082/api/tasks";  when working with compose

const apiUrl = "http://localhost:8088/api/tasks";

// const apiUrl = "http://minikubeip:nodeportIP/api/tasks";
// const apiUrl = "http://192.168.49.2:30038/api/tasks"; // for minikube node port backend service 

// const apiUrl ="http://backend-route-mdarwish11-dev.apps.rm2.thpm.p1.openshiftapps.com/api/tasks"; // for openshift using terminal 


export function getTasks() {
    return axios.get(apiUrl);
}

export function addTask(task) {
    console.log("Sending task to backend:", task);
    return axios.post(apiUrl, task);
}

export function updateTask(id, task) {
    return axios.put(apiUrl + "/" + id, task);
}

export function deleteTask(id) {
    return axios.delete(apiUrl + "/" + id);
}

addTask({ task: "Buy milk", completed: false })
  .then((res) => console.log("Added:", res.data))
  .catch((err) => console.error("Error adding task:", err.response?.data || err.message));
