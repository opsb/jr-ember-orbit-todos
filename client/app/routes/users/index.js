import Ember from "ember";

export
default Ember.Route.extend({
    model: function(){
    	window.store = this.store;
        return this.store.find('user');
    },

    setupController: function(controller, model){
    	controller.set("model", model);
    	controller.resetNewUser();
    },

    actions: {
    	addUser: function(){
    		var controller = this.get("controller");

    		this.store.add('user', controller.get("newUser")).then(function(newUser){
                controller.get("model").pushObject(newUser);
    			controller.resetNewUser();
    		});
    	}
    }
});
