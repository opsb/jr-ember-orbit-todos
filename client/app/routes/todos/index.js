export default Ember.Route.extend({
	needs: ['user'],

	model: function(params){
		return this.modelFor('user').get('todos');
	},

	actions: {
		addTodo: function(){
			var self = this;
			var controller = this.get("controller");

			this.store.add('todo', {
				title: controller.get("title"),
				description: controller.get("description")
			}).then(function(todo){
				todo.set("user", self.modelFor('user'));
            })

		}
	}
});