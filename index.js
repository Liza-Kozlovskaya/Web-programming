const program = require('commander'); //коммандная строка
const { prompt } = require('inquirer'); //работа с пользовательским вводом
const fs = require('fs'); //модуль для работы с файлами
const path = require('path'); //работа с путями к файлам и директориям
const util = require('util');
const uuid = require('uuid');

/*Информация о программе */
program
  .version('0.0.1')
  .description('This is a TODO application');

const ACCOUNT_ID = 1; // аккаунт с которого создаём задания

/*Все задания записываются в json файл store.json */
const STORAGE_PATH = path.resolve('./store.json'); 
const { 
    O_APPEND, //изменение
    O_RDONLY, //только чтение
    O_CREAT  //создание
} = fs.constants;

const fsOpen = util.promisify(fs.open); //открыти файл
const fsReadFile = util.promisify(fs.readFile); //чтение из файла
const fsWriteFile = util.promisify(fs.writeFile); //запись в файл


/*Получить все задания */
function getAllTodos() {
  return fsReadFile(STORAGE_PATH, { encoding: 'utf8', flag: O_RDONLY | O_CREAT })
    .then((data) => {
      let jsonText = data;
      if (!jsonText) jsonText = '{}';
      return JSON.parse(jsonText);
    })
    .then((storage) => {
      return storage.todos || [];
    });
}

/*Сохранить все задания*/
function saveAllTodos(todos) {
  return fsOpen(STORAGE_PATH, O_APPEND | O_CREAT)
    .then(() => {
      fsWriteFile(STORAGE_PATH, JSON.stringify({ todos }));
    });
}

/*Функция для поиска индекса */
function findTodoIndex(id, todos) {
  return todos.findIndex((todo) => todo.id === id);
}

/*Вывод информации*/
function print(...args) {
  console.info(...args);
}

/*Статусы */
const TODO_STATUS = {
    OPEN: "TODO_STATUS_OPEN",
    IN_PROGRESS: "TODO_STATUS_IN_PROGRESS",
    DONE: "TODO_STATUS_DONE",
  }

  /*Создание нового задания*/
function createTodo(data) {
  return {
    comment: null,
    createdDate: new Date(),
    createdByUserId: ACCOUNT_ID,
    id: uuid(),
    isLiked: false,
    status: TODO_STATUS.OPEN,
    lastUpdateDate: new Date(),
    lastUpdateByUserId: ACCOUNT_ID,
    ...data,
  };
}

function updateTodo(change, todo, status) {
  return {
    ...todo,
    ...change,
    ...status,
    id: uuid(),
    lastUpdateDate: new Date(),
    lastUpdateByUserId: ACCOUNT_ID,
    createdDate: new Date(),
    createdByUserId: ACCOUNT_ID,
  };
}

/*Создание нового задания */
function createTodoItem(data) {
  let todoId;

  return getAllTodos()
    .then((todos) => {
      const todo = createTodo(data);
      todoId = todo.id;
      const result = [...todos, todo];
      return saveAllTodos(result);
    })
    .then(() => todoId);
}

/*Редактирование задач */
function updateTodoItem(id, change) {
  return getAllTodos()
    .then((todos) => {
      const index = findTodoIndex(id, todos);
      const target = todos[index];
      const result = [...todos];

      //удаляем 1 элемент с определённым index 
      result.splice(index, 1, updateTodo(change, target));

      return saveAllTodos(result);
    })
    .then(() => id);
}

/*Функция удаления задания из листа */
function removeTodoItem(id) {
  return getAllTodos() //возвращаем все задания без удалённого
    .then((todos) => {
      const index = findTodoIndex(id, todos); //index равен id задания в листе
      const result = [...todos];
    
      //splice: удаляет 1 элемент с определённым index
      const removedItems = result.splice(index, 1);

      //сохраняем изменения
      return saveAllTodos(result)
      .then(() => removedItems.length);
    });
}

/*Вопросы*/

/*Запрос при создании задания */
/*Вводится: название задания и его описание */
const createQuestions = [
  {
    type : 'input',
    name : 'title',
    message : 'Enter title ...'
  },
  {
    type : 'input',
    name : 'description',
    message : 'Enter description ...'
  },
];

/*Запрос при редактировании задания */
/*Изменяем: название задания и его описание */
const updateQuestions = [
  {
    type : 'input',
    name : 'title',
    message : 'Enter new title ...'
  },
  {
    type : 'input',
    name : 'description',
    message : 'Enter new description ...'
  },
];

/*Запрос ввода комментария к задаче */
const commentQuestions = [
  {
    type : 'input',
    name : 'comment',
    message : 'Enter comment ...'
  },
];

/*Комманды*/
program
    //создать запись//
  .command('create')
  .description('Create new TODO item')
  .action(() => {
    prompt(createQuestions)
     //then: при успешном выполнении 
      .then(({ title, description }) => createTodoItem({ title, description }))
      .then(print)
      //catch: сработает при ошибке
      .catch((error) => {
        throw error;
      });
  });

program
    //обновить запись//
  .command('update <id>')
  .description('Update TODO item')
  .action((id) => {
    prompt(updateQuestions)
      .then(({ title, description }) => updateTodoItem(id, { title, description }))
      .then(print)
      .catch((e) => {
        throw e;
      });
  });

program
    //удалить запись//
  .command('remove <id>')
  //alias: сокращение, чтобы не писать "remove"
  .alias('rm') 
  .description('Remove TODO item by id')
  .action((id) => {
    removeTodoItem(id)
      .then(print)
      .catch((e) => {
        throw e;
      });
  });

  //название статусов для пользователей
const statusMap ={
    open: TODO_STATUS.OPEN,
    inprogress: TODO_STATUS.IN_PROGRESS,
    done: TODO_STATUS.DONE,
  };

program
    //вывести список всех записей//
    .command('list')
    .description('list all Todos, can be filtered by --status option')
    //фильтр тасков по статусу
    .option('--status <status>')
    .action(({status}) => {
        const todos = getAllTodos();
        if(!status){
            todos.then((todos) => {print(todos)});
        }
        else{
            if(status == 'open' || status == 'done' || status == 'inprogress') {
                const parsedStatus = statusMap[status];
                todos.then((data) => { print(data.filter(cur => cur.status == parsedStatus))});
            }
            else {
                print("Invalid status");
                return;
            }
        }
        
    });    

program
    //Отметить задание как понравившееся//
  .command('like <id>')
  .description('Like TODO item')
  .action((id) => {
    updateTodoItem(id, { isLiked: true })
      .then(print)
      .catch((e) => {
        throw e;
      });
  });

program
    //Добавить комментарий //
  .command('comment <id>')
  .description('Comment TODO item')
  .action((id) => {
    prompt(commentQuestions)
      .then(({ comment }) => updateTodoItem(id, { comment }))
      .then(print)
      .catch((e) => {
        throw e;
      });
  });

  //изменение статусов по id
    program
    .command('status <id> <status>')
    .description('Update task status')
    .action((id, status)=>
    {
      if(status == 'open' || status == 'done' || status == 'inprogress')
        {
            getAllTodos()
                .then((todos) => {
                    todos.forEach(element => { 
                        if(element.id == id) 
                        element.status = statusMap[status]; 
                    })
                    saveAllTodos(todos);
                    updateTodoItem(id, {status})
                });
        }
        else {
            print("Invalid status.");
        }
    });

program.parse(process.argv);