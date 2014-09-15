export default Ember.Route.extend({
	needs: ['user'],

	model: function(params){
		return this.modelFor('user').get('todos');
	},

	actions: {
		addTodo: function(){
			var self = this;
			var controller = this.get("controller");

			// this.store.add('todo', controller.getProperties("title", "description")).then(function(todo){
			// 	console.log("setting user");
			// 	window.todo = todo;
			// 	todo.set("user_id", controller.get("model.id"));
			// });
			// debugger
			this.store.add('todo', {
				title: controller.get("title"),
				description: controller.get("description"),
				user_id: controller.get("model.id")
			})

		}
	}
});